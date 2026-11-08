import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadThreadsSession, saveThreadsSession, type ThreadsStoredSession } from '../../src/index.ts';

const session = (): ThreadsStoredSession => ({
  version: 1, username: 'synthetic-shop', capturedAt: '2026-01-01T00:00:00.000Z',
  forms: { threadListBody: 'variables=%7B%7D', messageListBody: 'variables=%7B%7D', headers: { cookie: 'synthetic' } },
  requestsListBody: 'variables=%7B%7D',
  incoming: { url: 'wss://gateway.threads.com/ws/lightspeed', cookie: 'synthetic', userAgent: 'synthetic', initialPackets: [new Uint8Array([1, 2, 255]), new Uint8Array([0])] },
  send: { body: 'variables=%7B%7D', headers: {}, senderFbid: '1' },
});

const withRoot = async (run: (directory: string) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), 'threads-session-'));
  try { await chmod(root, 0o700); await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test('saves owner-only and loads the same session, packets included', () => withRoot(async root => {
  const file = join(root, 'shop.json');
  await saveThreadsSession(file, session());
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(root), ['shop.json']);
  assert.deepEqual(await loadThreadsSession(file), session());
  await saveThreadsSession(file, { ...session(), username: 'replaced' });
  assert.equal((await loadThreadsSession(file)).username, 'replaced');
}));

test('refuses unsafe places and files without disclosing paths', () => withRoot(async root => {
  const file = join(root, 'shop.json');
  await assert.rejects(saveThreadsSession('relative.json', session()), /unavailable or invalid/);
  await assert.rejects(saveThreadsSession(join(root, 'missing', 'shop.json'), session()), /unavailable or invalid/);
  const open = join(root, 'open');
  await mkdir(open, { mode: 0o755 });
  await chmod(open, 0o755);
  await assert.rejects(saveThreadsSession(join(open, 'shop.json'), session()), /unavailable or invalid/);
  await saveThreadsSession(file, session());
  await chmod(file, 0o644);
  await assert.rejects(loadThreadsSession(file), error => !String(error).includes(root));
  await chmod(file, 0o600);
  await symlink(file, join(root, 'link.json'));
  await assert.rejects(loadThreadsSession(join(root, 'link.json')), /unavailable or invalid/);
}));

test('refuses malformed or incomplete contents', () => withRoot(async root => {
  const file = join(root, 'shop.json');
  await assert.rejects(saveThreadsSession(file, { ...session(), incoming: { ...session().incoming, initialPackets: [] } }), /unavailable or invalid/);
  for (const contents of ['not json', '{"version":2}', JSON.stringify({ ...session(), incoming: { ...session().incoming, initialPackets: ['not base64!'] } })]) {
    await writeFile(file, contents, { mode: 0o600 });
    await assert.rejects(loadThreadsSession(file), /unavailable or invalid/);
  }
}));
