import { constants } from 'node:fs';
import { lstat, open, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CapturedForms, ThreadsReadRequest } from './threads-dm-read.ts';
import type { ThreadsIncomingSession } from './threads-dm-incoming.ts';
import type { ThreadsTextSendCapture } from './threads-dm-send.ts';

/** One owner capture for one Threads account, as stored in its private session file. */
export interface ThreadsStoredSession {
  readonly version: 1;
  /** The account the capture command confirmed in the owner's browser. */
  readonly username: string;
  /** ISO time of the capture. */
  readonly capturedAt: string;
  /** Inbox list and message list forms; pass to `sessionFromCapturedForms`. */
  readonly forms: CapturedForms;
  /** Message requests list form, read with the same headers. */
  readonly requestsListBody?: string;
  /** Setup for `ThreadsDmIncoming` and `ThreadsDmInbox`. */
  readonly incoming: ThreadsIncomingSession;
  readonly send?: ThreadsTextSendCapture;
  readonly markRead?: ThreadsReadRequest;
}

const MAX_BYTES = 1024 * 1024;
const unavailable = () => new Error('Threads session file: unavailable or invalid');
const owned = (uid: number) => typeof process.getuid !== 'function' || uid === process.getuid();
const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isHeaders = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value)
  && Object.values(value).every(header => typeof header === 'string');
const isRequest = (value: any) => isString(value?.body) && isHeaders(value?.headers);

/**
 * Writes the session atomically at mode 0600. The file must be named by an absolute path
 * whose directory already exists, belongs to this user and is closed to everyone else.
 * Keep it outside every repository and shared folder.
 */
export async function saveThreadsSession(file: string, session: ThreadsStoredSession): Promise<void> {
  if (!isAbsolute(file) || !valid(toJson(session))) throw unavailable();
  const directory = dirname(file), temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const stat = await lstat(directory);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || !owned(stat.uid)) throw unavailable();
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    try { await handle.writeFile(JSON.stringify(toJson(session))); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, file);
    const parent = await open(directory, constants.O_RDONLY);
    try { await parent.sync(); } finally { await parent.close(); }
  } catch { throw unavailable(); }
  finally { await unlink(temporary).catch(() => undefined); }
}

/** Reads a session file written by `saveThreadsSession`; refuses links and files others can read. */
export async function loadThreadsSession(file: string): Promise<ThreadsStoredSession> {
  if (!isAbsolute(file)) throw unavailable();
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || !owned(stat.uid) || stat.size > MAX_BYTES) throw unavailable();
    const json = JSON.parse(await handle.readFile('utf8'));
    if (!valid(json)) throw unavailable();
    return { ...json, incoming: { ...json.incoming, initialPackets: json.incoming.initialPackets.map((packet: string) => new Uint8Array(Buffer.from(packet, 'base64'))) } };
  } catch { throw unavailable(); }
  finally { await handle?.close().catch(() => undefined); }
}

function toJson(session: ThreadsStoredSession) {
  return { ...session, incoming: { ...session.incoming, initialPackets: session.incoming.initialPackets.map(packet => Buffer.from(packet).toString('base64')) } };
}

function valid(json: any): boolean {
  const packets = json?.incoming?.initialPackets;
  return json?.version === 1 && isString(json.username) && isString(json.capturedAt)
    && isString(json.forms?.threadListBody) && isString(json.forms?.messageListBody) && isHeaders(json.forms?.headers)
    && (json.forms.messagePaginationBody === undefined || isString(json.forms.messagePaginationBody))
    && (json.forms.cursorVariable === undefined || isString(json.forms.cursorVariable))
    && (json.requestsListBody === undefined || isString(json.requestsListBody))
    && isString(json.incoming?.url) && isString(json.incoming.cookie) && isString(json.incoming.userAgent)
    && Array.isArray(packets) && packets.length > 0 && packets.length <= 4
    && packets.every((packet: unknown) => isString(packet) && /^[A-Za-z0-9+/]+={0,2}$/.test(packet))
    && (json.send === undefined || (isRequest(json.send) && isString(json.send.senderFbid)))
    && (json.markRead === undefined || isRequest(json.markRead));
}
