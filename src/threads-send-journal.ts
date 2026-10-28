import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type ThreadsSendJournalStatus = 'attempted' | 'acknowledged' | 'unknown';

export interface ThreadsSendJournal {
  /** Persist a claim before dispatch; false means this ID must never send again. */
  claim(draftId: string): Promise<boolean>;
  get(draftId: string): Promise<ThreadsSendJournalStatus | null>;
  complete(draftId: string, status: 'acknowledged' | 'unknown'): Promise<void>;
}

const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
const unavailable = () => new Error('Threads send journal: private storage unavailable; never retry an uncertain send');
const owned = (uid: number) => typeof process.getuid !== 'function' || uid === process.getuid();

/**
 * Owner-configured private directory OUTSIDE Git. Stores only random draft IDs
 * and status words, never credentials, account/message IDs, message text or URLs.
 * Requires a local filesystem with exclusive creation, atomic rename and fsync.
 */
export async function createFileThreadsSendJournal(directory: string): Promise<ThreadsSendJournal> {
  if (!isAbsolute(directory)) throw unavailable();
  try {
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const stat = await lstat(directory);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || !owned(stat.uid)) throw unavailable();
    // Persist the directory entry too; its parent must already exist.
    const parent = await open(dirname(directory), constants.O_RDONLY);
    try { await parent.sync(); } finally { await parent.close(); }
  } catch { throw unavailable(); }

  const path = (id: string): string => {
    if (!validId(id)) throw unavailable();
    return join(directory, id + '.state');
  };
  const syncDirectory = async () => {
    const handle = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await handle.sync(); } finally { await handle.close(); }
  };
  const get = async (id: string): Promise<ThreadsSendJournalStatus | null> => {
    if (!validId(id)) return null;
    let handle;
    try {
      handle = await open(path(id), constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || (stat.mode & 0o077) !== 0 || !owned(stat.uid) || stat.size > 64) throw unavailable();
      const status = (await handle.readFile('utf8')).trim();
      // A crash can leave an empty/partial claim. It remains consumed, never replayed.
      return status === 'attempted' || status === 'acknowledged' ? status : 'unknown';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw unavailable();
    } finally { try { await handle?.close(); } catch { throw unavailable(); } }
  };
  return {
    get,
    async claim(id) {
      let handle;
      try { handle = await open(path(id), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw unavailable();
      }
      try {
        await handle.writeFile('attempted\n');
        await handle.sync();
        await syncDirectory();
        return true;
      } catch { throw unavailable(); }
      finally { try { await handle.close(); } catch { throw unavailable(); } }
    },
    async complete(id, status) {
      const target = path(id);
      const temporary = target + '.' + randomUUID() + '.tmp';
      try {
        if ((status !== 'acknowledged' && status !== 'unknown') || await get(id) === null) throw unavailable();
        const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
        try { await handle.writeFile(status + '\n'); await handle.sync(); }
        finally { await handle.close(); }
        await rename(temporary, target);
        await syncDirectory();
      } catch { throw unavailable(); }
      finally { await unlink(temporary).catch(() => undefined); }
    },
  };
}
