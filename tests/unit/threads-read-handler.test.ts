import assert from 'node:assert/strict';
import test from 'node:test';
import { createThreadsReadHandler, ThreadsAuthRequiredError, type ThreadsReadHandlerOptions } from '../../src/index.ts';

// All identifiers, contents, and session-like values below are synthetic.
function setup(overrides: Partial<ThreadsReadHandlerOptions> = {}) {
  const calls: unknown[][] = [];
  const handler = createThreadsReadHandler({
    authorizeOwner: () => true,
    allowedThreadIds: ['test-chat'],
    reader: {
      async listThreads(cursor) {
        calls.push(['inbox', cursor]);
        return {
          threads: [{ id: 'test-chat' }, { id: 'excluded-chat' }],
          pageInfo: { hasNextPage: true, endCursor: 'next-page' },
        };
      },
      async listMessages(threadId, cursor) {
        calls.push(['messages', threadId, cursor]);
        return {
          messages: [{ messageId: 'm1', threadFbid: threadId, senderFbid: 'test-owner', timestampMs: '1000', content: 'synthetic text' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        };
      },
    },
    ...overrides,
  });
  return {
    calls,
    request: (path = '/api/threads', method = 'GET') => handler(new Request(`https://website.invalid${path}`, { method })),
  };
}

test('owner authorization fails closed without contacting Threads or exposing errors', async () => {
  for (const authorizeOwner of [() => false, async () => { throw new Error('private session'); }]) {
    const { request, calls } = setup({ authorizeOwner });
    const response = await request();
    assert.ok([401, 503].includes(response.status));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.doesNotMatch(await response.text(), /private session/);
    assert.deepEqual(calls, []);
  }
});

test('inbox exposes only allowlisted chats, preserves the cursor, and reads one page', async () => {
  const { request, calls } = setup();
  const response = await request('/api/threads?cursor=page%2B2');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await response.json(), {
    threads: [{ id: 'test-chat' }],
    pageInfo: { hasNextPage: true, endCursor: 'next-page' },
  });
  assert.deepEqual(calls, [['inbox', 'page+2']]);
});

test('messages require a consented thread and pass only thread ID and cursor', async () => {
  const { request, calls } = setup();
  for (const path of ['/api/threads/messages', '/api/threads/messages?threadId=excluded-chat']) {
    assert.equal((await request(path)).status, 404);
  }
  assert.deepEqual(calls, []);
  const response = await request('/api/threads/messages?threadId=test-chat&cursor=next');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).messages[0].content, 'synthetic text');
  assert.deepEqual(calls, [['messages', 'test-chat', 'next']]);
});

test('an empty allowlist performs no upstream reads', async () => {
  const { request, calls } = setup({ allowedThreadIds: [] });
  assert.deepEqual(await (await request()).json(), {
    threads: [], pageInfo: { hasNextPage: false, endCursor: null },
  });
  assert.deepEqual(calls, []);
});

test('unsupported routes, methods and malformed query parameters make no upstream calls', async () => {
  const { request, calls } = setup();
  const post = await request('/api/threads', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET');
  assert.equal((await request('/other')).status, 404);
  for (const query of ['cursor=', 'cursor=a&cursor=b', 'headers=secret', 'threadId=test-chat', `cursor=${'x'.repeat(8193)}`]) {
    assert.equal((await request(`/api/threads?${query}`)).status, 400);
  }
  assert.deepEqual(calls, []);
});

test('upstream failures are sanitized and never retried', async () => {
  for (const error of [new ThreadsAuthRequiredError('private detail'), new Error('private session')]) {
    let calls = 0;
    const { request } = setup({
      reader: {
        async listThreads() { calls++; throw error; },
        async listMessages() { throw error; },
      },
    });
    const response = await request();
    assert.equal(response.status, error instanceof ThreadsAuthRequiredError ? 503 : 502);
    assert.deepEqual(await response.json(), {
      error: error instanceof ThreadsAuthRequiredError ? 'threads_reconnect_required' : 'threads_read_failed',
    });
    assert.equal(calls, 1);
  }
});

test('inconsistent message thread IDs are rejected before exposing contents', async () => {
  const { request } = setup({
    reader: {
      async listThreads() { throw new Error('unused'); },
      async listMessages() {
        return {
          messages: [{ messageId: 'm2', threadFbid: 'excluded-chat', senderFbid: 'other', timestampMs: '1000', content: 'do not expose' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        };
      },
    },
  });
  const response = await request('/api/threads/messages?threadId=test-chat');
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /do not expose|excluded-chat/);
});
