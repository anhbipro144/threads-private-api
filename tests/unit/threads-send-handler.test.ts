import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createThreadsSendHandler, createFileThreadsSendJournal, type ThreadsSendHandlerOptions } from '../../src/index.ts';

// Synthetic identities, message contents, and session-like values only.
function capture(threadId = 'test-chat') {
  return { senderFbid: 'messaging-A', headers: { cookie: 'synthetic-cookie' },
    body: new URLSearchParams({ av: 'actor-A', doc_id: '123456',
      fb_api_req_friendly_name: 'WmiSlideTextMessageMutation', variables: JSON.stringify({
        thread_fbid: threadId, text_body: { sensitive_string_value: 'old draft' },
        offline_threading_id: '1', recipient_fbids: null, replied_to_message_id: null,
        forwarded_message_id: null, send_silently: false, mentioned_users: null, logging_data: null,
      }),
    }).toString(),
  };
}

function ack(init?: RequestInit): Response {
  const variables = JSON.parse(new URLSearchParams(String(init?.body)).get('variables')!);
  return Response.json({ data: { send_slide_text_message: {
    message_id: 'message-new', timestamp_ms: '123456', content_type: 'TEXT',
    as_micg_interface: { message_id: 'message-new', timestamp_ms: '123456',
      sender_fbid: 'messaging-A', thread_fbid: variables.thread_fbid,
      offline_threading_id: variables.offline_threading_id, content: { text_body: variables.text_body.sensitive_string_value },
    },
  } } });
}

function setup(overrides: Partial<ThreadsSendHandlerOptions> = {}) {
  const calls: RequestInit[] = [];
  let captures = 0;
  const options: ThreadsSendHandlerOptions = {
    authorizeOwner: () => true, websiteOrigin: 'https://website.invalid',
    conversations: [{ threadId: 'test-chat', senderLabel: 'Account A', recipientLabel: 'Account B',
      capture: () => { captures++; return capture(); },
    }],
    fetchImpl: async (_url, init) => { calls.push(init!); return ack(init); },
    ...overrides,
  };
  const handler = createThreadsSendHandler(options);
  const request = (path: string, value: unknown, headers: Record<string, string> = {}) => handler(new Request(
    'https://website.invalid' + path, { method: 'POST', headers: {
      Origin: 'https://website.invalid', 'Content-Type': 'application/json', ...headers,
    }, body: JSON.stringify(value) },
  ));
  const draft = async () => {
    const response = await request('/api/threads/drafts', { threadId: 'test-chat', text: 'exact synthetic draft' });
    assert.equal(response.status, 201);
    return response.json() as Promise<{ draftId: string; text: string; senderLabel: string; recipientLabel: string; sendCount: number }>;
  };
  const send = (draftId: string) => request('/api/threads/send', { draftId, approved: true, sendCount: 1 });
  return { options, handler, calls, captures: () => captures, request, draft, send };
}

test('preparing discloses exact review only to owner and never sends; confirmation is immutable and consumed', async () => {
  const s = setup(), review = await s.draft();
  assert.deepEqual([review.text, review.senderLabel, review.recipientLabel, review.sendCount],
    ['exact synthetic draft', 'Account A', 'Account B', 1]);
  assert.equal(s.calls.length, 0);
  assert.equal((await s.request('/api/threads/send', { draftId: review.draftId, approved: true, sendCount: 1, text: 'changed' })).status, 400);
  const first = await s.send(review.draftId), second = await s.send(review.draftId);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'private, no-store');
  assert.equal(first.headers.get('access-control-allow-origin'), null);
  const result = await first.json();
  assert.equal(result.status, 'acknowledged');
  assert.equal(result.requiresReceiptCheck, true);
  assert.deepEqual(await second.json(), result);
  assert.equal(s.calls.length, 1);
  assert(!JSON.stringify(result).includes('synthetic-cookie'));
});

test('concurrent confirmations issue one provider request', async () => {
  let ready!: () => void, release!: () => void, calls = 0;
  const started = new Promise<void>(resolve => { ready = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const s = setup({ fetchImpl: async (_url, init) => { calls++; ready(); await gate; return ack(init); } });
  const review = await s.draft(), first = s.send(review.draftId);
  await started;
  const concurrent = await s.send(review.draftId);
  assert.equal(concurrent.status, 202);
  assert.equal((await concurrent.json()).status, 'sending');
  release();
  assert.equal((await first).status, 200);
  assert.equal(calls, 1);
});

test('unknown delivery stays unknown and repeated confirmation cannot resend', async () => {
  let calls = 0;
  const s = setup({ fetchImpl: async () => { calls++; throw new Error('private upstream token and draft'); } });
  const review = await s.draft();
  for (let i = 0; i < 2; i++) {
    const response = await s.send(review.draftId);
    assert.equal(response.status, 202);
    const value = await response.json();
    assert.equal(value.status, 'unknown');
    assert.equal(value.requiresReceiptCheck, true);
    assert(!JSON.stringify(value).includes('private upstream'));
  }
  assert.equal(calls, 1);
});

test('authorization and same-origin checks fail closed before preparing or sending', async () => {
  for (const authorizeOwner of [() => false, async () => { throw new Error('private owner session'); }]) {
    const s = setup({ authorizeOwner });
    const response = await s.request('/api/threads/drafts', { threadId: 'test-chat', text: 'draft' });
    assert([401, 503].includes(response.status));
    assert(!String(await response.text()).includes('private owner'));
    assert.equal(s.captures(), 0);
  }
  const s = setup();
  for (const Origin of ['', 'https://other.invalid', 'https://website.invalid.evil.invalid']) {
    assert.equal((await s.request('/api/threads/drafts', { threadId: 'test-chat', text: 'draft' }, { Origin })).status, 403);
  }
  assert.equal(s.captures(), 0);
  assert.equal(s.calls.length, 0);
});

test('routes, body size, scope and exact one-send approval are validated without a provider call', async () => {
  const s = setup();
  for (const value of [null, [], {}, { threadId: 'test-chat', text: '' },
    { threadId: 'test-chat', text: 'x'.repeat(4097) }, { threadId: 'test-chat', text: 'draft', headers: {} }]) {
    assert.equal((await s.request('/api/threads/drafts', value)).status, 400);
  }
  assert.equal((await s.request('/api/threads/drafts', { threadId: 'excluded-chat', text: 'draft' })).status, 404);
  for (const value of [{ draftId: 'missing' }, { draftId: 'missing', approved: true, sendCount: 2 },
    { draftId: 'missing', approved: false, sendCount: 1 }]) {
    assert.equal((await s.request('/api/threads/send', value)).status, 400);
  }
  assert.equal((await s.request('/other', {})).status, 404);
  assert.equal((await s.handler(new Request('https://website.invalid/api/threads/send'))).status, 405);
  assert.equal((await s.request('/api/threads/drafts?text=unsafe', {})).status, 400);
  assert.equal((await s.request('/api/threads/drafts', {}, { 'Content-Type': 'text/plain' })).status, 400);
  assert.equal((await s.request('/api/threads/drafts', { text: '🧪'.repeat(3000) })).status, 400);
  assert.equal(s.calls.length, 0);
  assert.equal(s.captures(), 0);
});

test('capture bound to another conversation is refused without exposing the capture', async () => {
  const s = setup({ conversations: [{ threadId: 'test-chat', senderLabel: 'A', recipientLabel: 'B', capture: () => capture('wrong-chat') }] });
  const response = await s.request('/api/threads/drafts', { threadId: 'test-chat', text: 'draft' });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'threads_send_unavailable' });
  assert.equal(s.calls.length, 0);
});

test('streamed JSON handles split UTF-8 and refuses oversized or malformed bodies without sending', async () => {
  const s = setup();
  const bytes = new TextEncoder().encode(JSON.stringify({ threadId: 'test-chat', text: 'draft 🧪' }));
  const cases: { chunks: Uint8Array[]; status: number }[] = [
    { chunks: [...bytes].map(byte => new Uint8Array([byte])), status: 201 },
    { chunks: [new Uint8Array(8193)], status: 400 },
    { chunks: [new Uint8Array([0xff])], status: 400 },
    { chunks: [new TextEncoder().encode('{broken-json')], status: 400 },
  ];
  for (const { chunks, status } of cases) {
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    } });
    const init = { method: 'POST', headers: { Origin: 'https://website.invalid', 'Content-Type': 'application/json' },
      body: stream, duplex: 'half' as const,
    };
    assert.equal((await s.handler(new Request('https://website.invalid/api/threads/drafts', init))).status, status);
  }
  assert.equal(s.calls.length, 0);
});

test('expired drafts and old IDs after restart cannot send; pending storage is bounded', async t => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const s = setup(), review = await s.draft();
  const restarted = setup();
  assert.equal((await restarted.send(review.draftId)).status, 404);
  for (let i = 1; i < 32; i++) await s.draft();
  assert.equal((await s.request('/api/threads/drafts', { threadId: 'test-chat', text: 'draft' })).status, 429);
  now += 10 * 60_000;
  assert.equal((await s.send(review.draftId)).status, 404);
  await s.draft();
  assert.equal(s.calls.length, 0);
  assert.equal(restarted.calls.length, 0);
});

test('a durable claim precedes provider dispatch and acknowledgement survives handler restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'threads-handler-journal-'));
  try {
    const journal = await createFileThreadsSendJournal(directory);
    let id = '', calls = 0;
    const s = setup({ journal, fetchImpl: async (_url, init) => {
      calls++;
      assert.equal(await journal.get(id), 'attempted');
      return ack(init);
    } });
    id = (await s.draft()).draftId;
    assert.equal(await journal.get(id), null);
    assert.equal((await s.send(id)).status, 200);
    const reopened = await createFileThreadsSendJournal(directory);
    const restarted = setup({ ...s.options, journal: reopened });
    const response = await restarted.send(id);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { draftId: id, status: 'acknowledged', recovered: true, requiresReceiptCheck: true });
    assert.equal(calls, 1);
    assert.equal(await readFile(join(directory, id + '.state'), 'utf8'), 'acknowledged\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('claimed or uncertain sends recover as unknown, without another provider request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'threads-handler-journal-'));
  try {
    const journal = await createFileThreadsSendJournal(directory);
    let calls = 0;
    const s = setup({ journal: { ...journal, async complete() { throw new Error('private storage detail'); } },
      fetchImpl: async () => { calls++; throw new Error('simulated lost response'); },
    });
    const review = await s.draft();
    assert.equal((await s.send(review.draftId)).status, 202);
    assert.equal(await journal.get(review.draftId), 'attempted');
    const restarted = setup({ ...s.options, journal: await createFileThreadsSendJournal(directory) });
    const recovered = await restarted.send(review.draftId);
    assert.equal(recovered.status, 202);
    assert.deepEqual(await recovered.json(), { draftId: review.draftId, status: 'unknown', recovered: true, requiresReceiptCheck: true });
    assert.equal(calls, 1);
    // A prior process can claim and exit before dispatch. Its ID is still consumed.
    const second = await s.draft();
    await journal.claim(second.draftId);
    assert.equal((await s.send(second.draftId)).status, 202);
    assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('journal failure before dispatch stops sending and sanitizes the failure', async () => {
  const s = setup({ journal: {
    async claim() { throw new Error('private journal path'); },
    async get() { return null; },
    async complete() { throw new Error('must not complete an unclaimed send'); },
  } });
  const review = await s.draft();
  const failed = await s.send(review.draftId);
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'threads_send_journal_unavailable', doNotResend: true });
  assert.equal((await s.send(review.draftId)).status, 202);
  assert.equal(s.calls.length, 0);
});

test('send auth rejection requests reconnect while preserving unknown delivery and no retry', async () => {
  let calls = 0;
  const s = setup({ fetchImpl: async () => { calls++; return new Response('private rejection', { status: 403 }); } });
  const review = await s.draft();
  const pending = await s.draft();
  const response = await s.send(review.draftId);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { draftId: review.draftId, status: 'unknown', reconnectRequired: true, requiresReceiptCheck: true });
  await s.send(review.draftId);
  const blocked = await s.send(pending.draftId);
  assert.equal(blocked.status, 503);
  assert.deepEqual(await blocked.json(), { error: 'threads_reconnect_required' });
  const newDraft = await s.request('/api/threads/drafts', { threadId: 'test-chat', text: 'another draft' });
  assert.equal(newDraft.status, 503);
  assert.deepEqual(await newDraft.json(), { error: 'threads_reconnect_required' });
  assert.equal(calls, 1);
});
