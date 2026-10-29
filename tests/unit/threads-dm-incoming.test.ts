import assert from 'node:assert/strict';
import test from 'node:test';
import { ThreadsDmIncoming, ThreadsIncomingError, type ThreadsIncomingSession, type DmMessage } from '../../src/index.ts';
import { IncomingFrames, decodeIncomingEnvelope, MAX_INCOMING_BYTES } from '../../src/threads-incoming-protocol.ts';

// Synthetic configuration, identifiers, cookies and text only. No provider calls.
function frame(type: number, payload: Buffer = Buffer.alloc(0), stream = 1, ack = 7, required = false): Buffer {
  if ([2, 4, 9, 10].includes(type)) return Buffer.from([type]);
  if (type === 14) return Buffer.from([14, stream & 255, stream >> 8]);
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
function envelope(operation: number, bytes: Buffer = Buffer.alloc(0), requestId = 17): Buffer {
  return Buffer.from(JSON.stringify({ request_id: requestId, payload: field(2, field(operation, bytes)).toString('base64') }));
}
const config = { app_id: 'synthetic-app', device_id: 'synthetic-device', request_id: 17, type: 2,
  payload: JSON.stringify({ database: 231, last_applied_cursor: '{"seq_id":0}' }) };
function session(): ThreadsIncomingSession {
  return { url: 'wss://gateway.threads.com/ws/lightspeed?x-dgw-version=5&x-dgw-authtype=6%3A0',
    cookie: 'synthetic=session', userAgent: 'synthetic-agent', initialPackets: [Buffer.concat([
      frame(15, Buffer.from('{}')), frame(13, Buffer.from(JSON.stringify(config)), 1, 7, true),
    ])] };
}
function entry(id = 'message-1', thread = 'test-chat', text = 'synthetic text') {
  return { __typename: 'SlideUQPPNewMessage', thread_fbid: thread, message: { as_micg_interface: {
    thread_fbid: thread, message_id: id, sender_fbid: 'test-B', timestamp_ms: '1000', content: { text_body: text },
  } } };
}
function delta(entries: unknown[]): Buffer {
  return envelope(3, field(2, Buffer.from(JSON.stringify({ data: { slide_delta_processor: entries } }))));
}
class Socket extends EventTarget {
  binaryType = '';
  readyState = 1;
  sent: Buffer[] = [];
  closes = 0;
  send(bytes: Uint8Array): void { this.sent.push(Buffer.from(bytes)); }
  close(): void { this.closes++; this.readyState = 3; this.dispatchEvent(new Event('close')); }
  receive(bytes: Uint8Array): void { this.dispatchEvent(new MessageEvent('message', { data: Uint8Array.from(bytes).buffer })); }
  authenticate(): void {
    this.receive(frame(10));
    this.receive(Buffer.concat([frame(15, Buffer.from('{"code":200}')), frame(12), frame(13, envelope(1), 1, 3, true)]));
  }
}
function setup(onMessage: (message: DmMessage) => void | Promise<void> = () => {}, seenMessageIds: string[] = []) {
  const socket = new Socket(), capture = session();
  let connections = 0;
  const receiver = new ThreadsDmIncoming({ session: capture, threadId: 'test-chat', seenMessageIds, onMessage,
    socketFactory: (url, init) => { connections++; assert.equal(url, capture.url); assert.equal(init.headers['cookie'], 'synthetic=session'); return socket as unknown as WebSocket; },
  });
  return { socket, receiver, capture, connections: () => connections };
}
async function ready(onMessage?: (message: DmMessage) => void | Promise<void>, seen?: string[]) {
  const context = setup(onMessage, seen), starting = context.receiver.start();
  context.socket.authenticate(); await starting; return context;
}
const reason = (expected: ThreadsIncomingError['reason']) => (error: unknown) => error instanceof ThreadsIncomingError && error.reason === expected;

test('receiver replays a private copy once, filters scope, deduplicates and stops cleanly', async () => {
  const messages: DmMessage[] = [], context = setup(message => { messages.push(message); }, ['already-read']);
  const expected = Buffer.from(context.capture.initialPackets[0]!);
  context.capture.initialPackets[0]!.fill(0);
  const starting = context.receiver.start();
  assert.equal(context.receiver.start(), starting);
  context.socket.authenticate(); await starting;
  assert.equal(context.receiver.state, 'ready');
  assert.deepEqual(context.socket.sent[0], expected);
  assert.deepEqual(context.socket.sent[1], frame(12, Buffer.alloc(0), 1, 3));
  context.socket.receive(frame(10));
  assert.equal(context.socket.sent.length, 2);
  const incoming = frame(13, delta([entry('already-read'), entry('other', 'other-chat'), entry()]), 1, 9, true);
  for (const byte of incoming) context.socket.receive(Uint8Array.of(byte));
  context.socket.receive(incoming);
  assert.deepEqual(messages, [{ messageId: 'message-1', threadFbid: 'test-chat', senderFbid: 'test-B', timestampMs: '1000', content: 'synthetic text' }]);
  context.receiver.stop(); context.receiver.stop(); await context.receiver.closed;
  context.socket.receive(incoming); context.socket.dispatchEvent(new Event('error'));
  assert.equal(messages.length, 1);
  assert.equal(context.receiver.state, 'stopped'); assert.equal(context.socket.closes, 1); assert.equal(context.connections(), 1);
  await assert.rejects(context.receiver.start(), reason('stopped'));
  assert(!JSON.stringify(context.receiver).includes('synthetic=session'));
});

test('start resolves only after establish, matching ack and matching subscription', async () => {
  const { socket, receiver } = setup(); const started = receiver.start();
  socket.receive(frame(10)); socket.receive(frame(15, Buffer.from('{"code":200}')));
  socket.receive(frame(13, envelope(1)));
  assert.equal(receiver.state, 'connecting');
  socket.receive(frame(12)); await started; assert.equal(receiver.state, 'ready'); receiver.stop();
});

test('invalid session/captured packets fail before connecting, without private error values', () => {
  for (const capture of [
    { ...session(), url: 'wss://elsewhere.invalid/private?cookie=secret' },
    { ...session(), url: session().url + '&x-dgw-version=5' },
    { ...session(), cookie: 'synthetic=secret\r\nHeader: value' },
    { ...session(), initialPackets: [frame(13, Buffer.from('secret'))] },
    { ...session(), initialPackets: [frame(15, Buffer.from('{}')), frame(13, Buffer.from(JSON.stringify(config)), 2, 7, true)] },
  ]) assert.throws(() => new ThreadsDmIncoming({ session: capture, threadId: 'test-chat', onMessage: () => {} }), error => reason('invalid-session')(error) && !String(error).includes('secret'));
});

test('wrong stream/ack/request IDs, conflicting duplicates and provider reset fail closed', async () => {
  const failures = [frame(13, delta([entry()]), 2), frame(12, Buffer.alloc(0), 1, 99),
    frame(13, envelope(1, Buffer.alloc(0), 999)), frame(13, envelope(2)), frame(13, envelope(5)),
    frame(4), frame(14), frame(13, Buffer.from('{"error_code":42,"error_message":"private secret"}'))];
  for (const bytes of failures) {
    const { socket, receiver } = await ready();
    socket.receive(bytes); await assert.rejects(receiver.closed, error => error instanceof ThreadsIncomingError && !String(error).includes('private secret'));
    assert.equal(receiver.state, 'failed'); assert.equal(socket.closes, 1);
  }
  const { socket, receiver } = await ready();
  socket.receive(frame(13, delta([entry()]))); socket.receive(frame(13, delta([entry('message-1', 'test-chat', 'changed')])));
  await assert.rejects(receiver.closed, reason('protocol-rejected'));
});

test('stopping before/during startup rejects readiness without failing closed, and cannot restart', async () => {
  for (const connect of [false, true]) {
    const { receiver, socket, connections } = setup();
    const started = connect ? receiver.start() : undefined;
    receiver.stop(); await receiver.closed;
    await assert.rejects(started ?? receiver.start(), reason('stopped'));
    assert.equal(receiver.state, 'stopped'); assert.equal(socket.closes, connect ? 1 : 0); assert.equal(connections(), connect ? 1 : 0);
  }
});

test('errors/closure after readiness and synchronous/asynchronous callback failures reject closed', async () => {
  for (const act of [(s: Socket) => s.close(), (s: Socket) => s.dispatchEvent(new Event('error'))]) {
    const { receiver, socket, connections } = await ready(); act(socket); await assert.rejects(receiver.closed, reason('connection-failed'));
    await assert.rejects(receiver.start(), reason('connection-failed')); assert.equal(connections(), 1);
  }
  for (const callback of [() => { throw Error('secret'); }, async () => { throw Error('secret'); }]) {
    const { receiver, socket } = await ready(callback); socket.receive(frame(13, delta([entry()])));
    await assert.rejects(receiver.closed, reason('callback-failed'));
  }
});

test('callback stop prevents later batch deliveries; dedupe cap stops instead of forgetting IDs', async () => {
  const received: DmMessage[] = [];
  const context = await ready(message => { received.push(message); context.receiver.stop(); });
  context.socket.receive(frame(13, delta([entry('one'), entry('two')])));
  await context.receiver.closed; assert.equal(received.length, 1);
  const full = setup(() => { assert.fail('must not deliver beyond dedupe bound'); }, Array.from({ length: 10000 }, (_, i) => 'seen-' + i));
  const start = full.receiver.start(); full.socket.authenticate(); await start;
  full.socket.receive(frame(13, delta([entry()])));
  await assert.rejects(full.receiver.closed, reason('protocol-rejected'));
});

test('startup and idle deadlines close once; explicit stop removes ping activity', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const waiting = setup(), start = waiting.receiver.start();
  t.mock.timers.tick(20001); await assert.rejects(start, reason('timeout')); await assert.rejects(waiting.receiver.closed, reason('timeout'));
  const live = await ready();
  t.mock.timers.tick(10000); assert.deepEqual(live.socket.sent.at(-1), frame(9));
  t.mock.timers.tick(20001); await assert.rejects(live.receiver.closed, reason('timeout'));
  const stopped = await ready(); stopped.receiver.stop(); const sent = stopped.socket.sent.length;
  t.mock.timers.tick(60000); assert.equal(stopped.socket.sent.length, sent); await stopped.receiver.closed;
});

test('frame decoder supports every split point and rejects oversized/unsupported framing', () => {
  const bytes = Buffer.concat([frame(10), frame(15, Buffer.from('{}')), frame(13, Buffer.from('synthetic'))]);
  for (let split = 0; split <= bytes.length; split++) {
    const reader = new IncomingFrames(), result = [...reader.push(bytes.subarray(0, split)), ...reader.push(bytes.subarray(split))];
    assert.deepEqual(result.map(f => f.type), [10, 15, 13]); assert.equal(reader.incomplete, false);
  }
  const incomplete = new IncomingFrames(); incomplete.push(bytes.subarray(0, -1)); assert(incomplete.incomplete); incomplete.clear(); assert(!incomplete.incomplete);
  for (const bytes of [Buffer.from([99]), Buffer.from([13, 0, 0, 1, 0, 0]), Buffer.from([12, 0, 0, 2, 0, 0, 0, 128]),
    Buffer.from([13, 0, 0, 255, 255, 255]), Buffer.alloc(MAX_INCOMING_BYTES * 2 + 1)]) assert.throws(() => new IncomingFrames().push(bytes));
});

test('malformed base64, protobuf bounds/wire types/oneofs and mismatched conversation reject', () => {
  const raw = (payload: string) => Buffer.from(JSON.stringify({ payload }));
  for (const bytes of [raw('!invalid!'), raw('AB=='), raw(Buffer.from([18, 128]).toString('base64')),
    raw(field(2, Buffer.from([11])).toString('base64')), raw(field(2, Buffer.concat([field(1, Buffer.alloc(0)), field(3, Buffer.alloc(0))])).toString('base64')),
    envelope(3, Buffer.concat([field(2, Buffer.from('{}')), field(2, Buffer.from('{}'))])),
    delta([{ ...entry(), message: entry('x', 'other-chat').message }])]) {
    assert.throws(() => decodeIncomingEnvelope(bytes, 'test-chat'));
  }
  assert.deepEqual(decodeIncomingEnvelope(delta([entry('x', 'other-chat')]), 'test-chat').messages, []);
});
