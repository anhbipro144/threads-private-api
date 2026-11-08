import assert from 'node:assert/strict';
import test from 'node:test';
import { ThreadsDmInbox, ThreadsIncomingError, type ThreadsIncomingSession, type ThreadsInboxState } from '../../src/index.ts';

// Synthetic configuration, identifiers, cookies and text only. No provider calls.
function frame(type: number, payload: Buffer = Buffer.alloc(0), stream = 1, ack = 7, required = false): Buffer {
  if ([2, 4, 9, 10].includes(type)) return Buffer.from([type]);
  const header = Buffer.alloc(type === 15 ? 6 : 8);
  header[0] = type; header.writeUInt16LE(stream, 1);
  header.writeUIntLE(payload.length + (type === 15 ? 0 : 2), 3, 3);
  if (type !== 15) header.writeUInt16LE(ack | (required ? 32768 : 0), 6);
  return Buffer.concat([header, payload]);
}
function varint(number: number): Buffer {
  const bytes: number[] = [];
  do { const byte = number & 127; number >>>= 7; bytes.push(byte | (number ? 128 : 0)); } while (number);
  return Buffer.from(bytes);
}
const field = (id: number, bytes: Buffer): Buffer => Buffer.concat([varint(id * 8 + 2), varint(bytes.length), bytes]);
const envelope = (operation: number, bytes: Buffer = Buffer.alloc(0)) =>
  Buffer.from(JSON.stringify({ request_id: 17, payload: field(2, field(operation, bytes)).toString('base64') }));
const config = { app_id: 'synthetic-app', device_id: 'synthetic-device', request_id: 17, type: 2,
  payload: JSON.stringify({ database: 231, last_applied_cursor: '{"seq_id":0}' }) };
const session = (): ThreadsIncomingSession => ({ url: 'wss://gateway.threads.com/ws/lightspeed?x-dgw-version=5&x-dgw-authtype=6%3A0',
  cookie: 'synthetic=session', userAgent: 'synthetic-agent',
  initialPackets: [Buffer.concat([frame(15, Buffer.from('{}')), frame(13, Buffer.from(JSON.stringify(config)), 1, 7, true)])] });
const message = (id: string) => frame(13, envelope(3, field(2, Buffer.from(JSON.stringify({ data: { slide_delta_processor: [
  { __typename: 'SlideUQPPNewMessage', thread_fbid: 'chat-A', message: { as_micg_interface: {
    thread_fbid: 'chat-A', message_id: id, sender_fbid: 'test-B', timestamp_ms: '1000', content: { text_body: 'synthetic' } } } },
] } })))));
class Socket extends EventTarget {
  binaryType = ''; readyState = 1;
  send(): void {}
  close(): void { this.readyState = 3; }
  receive(bytes: Uint8Array): void { this.dispatchEvent(new MessageEvent('message', { data: Uint8Array.from(bytes).buffer })); }
  authenticate(): void {
    this.receive(frame(10));
    this.receive(Buffer.concat([frame(15, Buffer.from('{"code":200}')), frame(12), frame(13, envelope(1), 1, 3, true)]));
  }
  drop(code = 1006): void { this.dispatchEvent(Object.assign(new Event('close'), { code })); }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++) await tick();
  assert(condition(), 'condition not reached');
}
function inbox(overrides: Partial<ConstructorParameters<typeof ThreadsDmInbox>[0]> = {}) {
  const sockets: Socket[] = [], states: ThreadsInboxState[] = [], received: string[] = [];
  let sessions = 0, reconciles = 0;
  const box = new ThreadsDmInbox({ maxBackoffMs: 0,
    getSession: async () => { sessions++; return session(); },
    reconcile: async () => { reconciles++; },
    onMessage: m => { received.push(m.messageId); },
    onState: s => { states.push(s); },
    socketFactory: () => { const s = new Socket(); sockets.push(s); return s as unknown as WebSocket; },
    ...overrides });
  return { box, sockets, states, received, sessions: () => sessions, reconciles: () => reconciles };
}

test('inbox reconnects after a drop with a new session, reconciles, skips replayed messages, and keeps delivering', async () => {
  const c = inbox();
  c.box.start();
  await until(() => c.sockets.length === 1); c.sockets[0]!.authenticate();
  await until(() => c.box.state === 'live');
  assert.equal(c.reconciles(), 0);
  c.sockets[0]!.receive(message('one'));
  await until(() => c.received.length === 1);
  c.sockets[0]!.drop();
  await until(() => c.sockets.length === 2); c.sockets[1]!.authenticate();
  await until(() => c.reconciles() === 1 && c.box.state === 'live');
  c.sockets[1]!.receive(message('one')); // replayed by the old setup packets
  c.sockets[1]!.receive(message('two'));
  await until(() => c.received.length === 2);
  assert.deepEqual(c.received, ['one', 'two']);
  assert.deepEqual(c.states, ['live', 'reconnecting', 'live']);
  assert.equal(c.sessions(), 2);
  c.box.stop();
  await c.box.closed;
  assert.equal(c.box.state, 'stopped');
});

test('a failing callback or protocol error ends the inbox without reconnecting', async () => {
  const c = inbox({ onMessage: () => { throw new Error('host failure'); } });
  c.box.start();
  await until(() => c.sockets.length === 1); c.sockets[0]!.authenticate();
  await until(() => c.box.state === 'live');
  c.sockets[0]!.receive(message('one'));
  await assert.rejects(c.box.closed, (e: unknown) => e instanceof ThreadsIncomingError && e.reason === 'callback-failed' && e.messageId === 'one');
  assert.equal(c.box.state, 'failed');
  assert.equal(c.sockets.length, 1);
});

test('no session, or repeated failed attempts, asks for the owner', async () => {
  const none = inbox({ getSession: async () => undefined });
  none.box.start();
  await assert.rejects(none.box.closed);
  assert.equal(none.box.state, 'needs-owner');

  const c = inbox({ maxAttempts: 3 });
  c.box.start();
  for (let i = 0; i < 3; i++) { await until(() => c.sockets.length === i + 1); c.sockets[i]!.drop(); }
  await assert.rejects(c.box.closed, (e: unknown) => e instanceof ThreadsIncomingError && e.reason === 'connection-failed');
  assert.deepEqual(c.states, ['reconnecting', 'reconnecting', 'needs-owner']);
  assert.equal(c.reconciles(), 0);

  const flapping = inbox({ maxAttempts: 2 });
  flapping.box.start();
  for (let i = 0; i < 2; i++) {
    await until(() => flapping.sockets.length === i + 1); flapping.sockets[i]!.authenticate();
    await until(() => flapping.box.state === 'live'); flapping.sockets[i]!.drop();
  }
  await assert.rejects(flapping.box.closed);
  assert.equal(flapping.box.state, 'needs-owner');
});

test('stop during backoff ends quietly', async () => {
  const c = inbox({ maxBackoffMs: 60_000 });
  c.box.start();
  await until(() => c.sockets.length === 1); c.sockets[0]!.drop();
  await until(() => c.box.state === 'reconnecting');
  c.box.stop();
  await c.box.closed;
  assert.equal(c.sockets.length, 1);
  assert.throws(() => new ThreadsDmInbox({ onMessage() {} } as never), TypeError);
});
