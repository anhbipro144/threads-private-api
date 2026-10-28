import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ThreadsDmReader,
  ThreadsAuthRequiredError,
  parseGraphqlEnvelope,
  parseThreadList,
  parseMessageList,
  sessionFromCapturedForms,
  type ThreadsDmReadSession,
} from '../../src/threads-dm-read.ts';

// Synthetic fixtures only. No real account IDs, session headers, or message
// contents — these are invented shapes that mirror the REPRODUCED read responses.
const threadListData = {
  get_slide_mailbox_for_iris_subscription: {
    threads_by_folder: {
      edges: [{ node: { id: 'thread-1' } }, { node: { id: 'thread-2' } }],
      page_info: { has_next_page: true, end_cursor: 'CURSOR-A' },
    },
  },
};

const messageListData = {
  get_slide_thread: {
    messages: {
      edges: [
        {
          node: {
            as_micg_interface: {
              message_id: 'm-1',
              thread_fbid: 'thread-1',
              sender_fbid: 'user-A',
              timestamp_ms: '1000',
              content: { text_body: 'hello' },
            },
          },
        },
      ],
      page_info: { has_next_page: false, end_cursor: null },
    },
  },
};

function stubSession(): ThreadsDmReadSession {
  return {
    listThreads: (cursor) => ({ body: cursor ? `cursor=${cursor}` : 'b', headers: {} }),
    listMessages: (threadId, cursor) => ({
      body: `thread=${threadId}${cursor ? `&cursor=${cursor}` : ''}`,
      headers: {},
    }),
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(`for(;;);${JSON.stringify(payload)}`, { status });
}

/** Rate cap disabled: these tests assert behaviour, not pacing. */
function reader(fetchImpl: typeof fetch, minIntervalMs = 0): ThreadsDmReader {
  return new ThreadsDmReader({ session: stubSession(), fetchImpl, minIntervalMs });
}

test('parseGraphqlEnvelope strips the for(;;); guard and extracts data', () => {
  assert.deepEqual(parseGraphqlEnvelope('for(;;);{"data":{"x":1}}'), { x: 1 });
});

test('parseGraphqlEnvelope rejects GraphQL errors and missing data', () => {
  assert.throws(() => parseGraphqlEnvelope('{"errors":[{"message":"bad"}]}'), /error/);
  assert.throws(() => parseGraphqlEnvelope('{"foo":1}'), /no data/);
});

test('parseThreadList returns thread ids and pagination', () => {
  const page = parseThreadList(threadListData);
  assert.deepEqual(page.threads.map((t) => t.id), ['thread-1', 'thread-2']);
  assert.deepEqual(page.pageInfo, { hasNextPage: true, endCursor: 'CURSOR-A' });
});

test('parseMessageList maps as_micg_interface fields', () => {
  const page = parseMessageList(messageListData);
  assert.equal(page.messages.length, 1);
  assert.deepEqual(page.messages[0], {
    messageId: 'm-1',
    threadFbid: 'thread-1',
    senderFbid: 'user-A',
    timestampMs: '1000',
    content: 'hello',
  });
  assert.deepEqual(page.pageInfo, { hasNextPage: false, endCursor: null });
});

test('parsers throw on malformed shapes instead of returning partial data', () => {
  assert.throws(() => parseThreadList({}), /missing mailbox/);
  assert.throws(() => parseMessageList({ get_slide_thread: { messages: {} } }), /missing edges/);
  assert.throws(
    () => parseMessageList({ get_slide_thread: { messages: { edges: [{ node: {} }] } } }),
    /as_micg_interface/,
  );
});

test('text content comes from the observed content.text_body object; unsupported content fails closed', () => {
  for (const content of ['hello', null, { text_body: null }, { attachment: {} }]) {
    const data = structuredClone(messageListData);
    const message = data.get_slide_thread.messages.edges[0]!.node.as_micg_interface;
    Object.assign(message, { content });
    assert.throws(() => parseMessageList(data), /text content object|content\.text_body/);
  }
});

test('ThreadsDmReader.listThreads replays the request and parses', async () => {
  let calledWith: string | undefined;
  const page = await reader(async (_url, init) => {
    calledWith = String(init?.body);
    return jsonResponse({ data: threadListData });
  }).listThreads();
  assert.equal(calledWith, 'b');
  assert.deepEqual(page.threads.map((t) => t.id), ['thread-1', 'thread-2']);
});

test('ThreadsDmReader.listMessages injects the thread id', async () => {
  let calledWith: string | undefined;
  await reader(async (_url, init) => {
    calledWith = String(init?.body);
    return jsonResponse({ data: messageListData });
  }).listMessages('thread-42');
  assert.equal(calledWith, 'thread=thread-42');
});

test('allThreads follows cursors across pages, then stops', async () => {
  const page2 = {
    get_slide_mailbox_for_iris_subscription: {
      threads_by_folder: {
        edges: [{ node: { id: 'thread-3' } }],
        page_info: { has_next_page: false, end_cursor: null },
      },
    },
  };
  const bodies: string[] = [];
  const ids: string[] = [];
  const client = reader(async (_url, init) => {
    const body = String(init?.body);
    bodies.push(body);
    return jsonResponse({ data: body === 'b' ? threadListData : page2 });
  });
  for await (const t of client.allThreads()) ids.push(t.id);
  assert.deepEqual(ids, ['thread-1', 'thread-2', 'thread-3']);
  assert.deepEqual(bodies, ['b', 'cursor=CURSOR-A']); // page 2 used the first page's end_cursor
});

test('allThreads throws rather than loop forever past the page cap', async () => {
  const neverEnds = {
    get_slide_mailbox_for_iris_subscription: {
      threads_by_folder: {
        edges: [{ node: { id: 'x' } }],
        page_info: { has_next_page: true, end_cursor: 'SAME' },
      },
    },
  };
  const client = reader(async () => jsonResponse({ data: neverEnds }));
  await assert.rejects(async () => {
    for await (const _ of client.allThreads(3)) { /* drain */ }
  }, /exceeded 3 pages/);
});

test('ThreadsDmReader surfaces non-200 as status only, without the body', async () => {
  await assert.rejects(
    reader(async () => new Response('secret-session-body', { status: 500 })).listThreads(),
    (error: Error) => {
      assert.match(error.message, /HTTP 500/);
      assert.doesNotMatch(error.message, /secret-session-body/);
      return true;
    },
  );
});

test('401/403 asks for re-auth rather than a generic failure', async () => {
  for (const status of [401, 403]) {
    await assert.rejects(
      reader(async () => new Response('secret-session-body', { status })).listThreads(),
      (error: Error) => {
        assert.ok(error instanceof ThreadsAuthRequiredError);
        assert.match(error.message, /re-auth required/);
        assert.doesNotMatch(error.message, /secret-session-body/);
        return true;
      },
    );
  }
});

test('HTTP-200 rejection envelope asks for re-auth and keeps the code', async () => {
  await assert.rejects(
    reader(async () => jsonResponse({ error: 1357054, payload: null })).listThreads(),
    (error: Error) => {
      assert.ok(error instanceof ThreadsAuthRequiredError);
      assert.equal((error as ThreadsAuthRequiredError).code, 1357054);
      return true;
    },
  );
});

test('a real GraphQL error is not mistaken for a re-auth prompt', () => {
  assert.throws(
    () => parseGraphqlEnvelope('{"errors":[{"message":"bad"}]}'),
    (error: Error) => !(error instanceof ThreadsAuthRequiredError) && /error/.test(error.message),
  );
});

test('rejected sessions pause reads until owner replacement; disconnect makes no request', async () => {
  for (const rejection of [new Response('private body', { status: 403 }), jsonResponse({ error: 1357054 })]) {
    const bodies: string[] = [];
    const client = reader(async (_url, init) => {
      bodies.push(String(init?.body));
      return bodies.length === 1 ? rejection : jsonResponse({ data: threadListData });
    });
    assert.equal(client.sessionStatus, 'configured');
    await assert.rejects(client.listThreads(), ThreadsAuthRequiredError);
    assert.equal(client.sessionStatus, 'reconnect-required');
    await assert.rejects(client.listThreads(), ThreadsAuthRequiredError);
    assert.equal(bodies.length, 1);
    client.replaceSession({ ...stubSession(), listThreads: () => ({ body: 'fresh synthetic session', headers: {} }) });
    assert.equal(client.sessionStatus, 'configured');
    await client.listThreads();
    assert.equal(client.sessionStatus, 'ready');
    assert.deepEqual(bodies, ['b', 'fresh synthetic session']);
    client.disconnect();
    await assert.rejects(client.listThreads(), ThreadsAuthRequiredError);
    assert.equal(client.sessionStatus, 'disconnected');
    assert.equal(bodies.length, 2);
  }
});

test('ordinary read failures do not falsely mark a session as rejected or retry', async () => {
  let calls = 0;
  const client = reader(async () => { calls++; return jsonResponse({ errors: [{ message: 'synthetic error' }] }); });
  await assert.rejects(client.listThreads());
  assert.equal(client.sessionStatus, 'configured');
  assert.equal(calls, 1);
});

test('late responses from a replaced session are discarded without rejecting the new session', async () => {
  for (const oldStatus of [200, 403]) {
    let release!: (value: Response) => void, started!: () => void;
    const active = new Promise<void>(resolve => { started = resolve; });
    let calls = 0;
    const client = reader(async () => {
      calls++;
      if (calls === 1) { started(); return new Promise<Response>(resolve => { release = resolve; }); }
      return jsonResponse({ data: threadListData });
    });
    const old = client.listThreads();
    await active;
    client.replaceSession(stubSession());
    await client.listThreads();
    release(jsonResponse({ data: threadListData }, oldStatus));
    await assert.rejects(old, /session changed/);
    assert.equal(client.sessionStatus, 'ready');
    assert.equal(calls, 2);
  }
});

test('a concurrent success cannot clear another read\'s auth rejection', async () => {
  const releases: ((response: Response) => void)[] = [];
  let started!: () => void;
  const bothStarted = new Promise<void>(resolve => { started = resolve; });
  const client = reader(async () => new Promise<Response>(resolve => {
    releases.push(resolve); if (releases.length === 2) started();
  }));
  const first = client.listThreads(), second = client.listThreads();
  await bothStarted;
  releases[0]!(jsonResponse({ error: 1357054 }));
  await assert.rejects(first, ThreadsAuthRequiredError);
  releases[1]!(jsonResponse({ data: threadListData }));
  await assert.rejects(second, ThreadsAuthRequiredError);
  await assert.rejects(client.listThreads(), ThreadsAuthRequiredError);
  assert.equal(client.sessionStatus, 'reconnect-required');
  assert.equal(releases.length, 2);
});

test('queued reads build from the replacement session at dispatch time', async () => {
  const bodies: string[] = [];
  const client = reader(async (_url, init) => { bodies.push(String(init?.body)); return jsonResponse({ data: threadListData }); }, 40);
  await client.listThreads();
  const queued = client.listThreads();
  client.replaceSession({ ...stubSession(), listThreads: () => ({ body: 'replacement', headers: {} }) });
  await queued;
  assert.deepEqual(bodies, ['b', 'replacement']);
});

test('the rate cap spaces requests and serializes concurrent callers', async () => {
  const at: number[] = [];
  const client = reader(async () => {
    at.push(Date.now());
    return jsonResponse({ data: threadListData });
  }, 40);
  await Promise.all([client.listThreads(), client.listThreads(), client.listThreads()]);
  assert.equal(at.length, 3);
  for (let i = 1; i < at.length; i++) {
    assert.ok(at[i]! - at[i - 1]! >= 35, `gap ${i} was ${at[i]! - at[i - 1]!}ms`);
  }
});

// Synthetic captures: invented token values, not real session material.
const capture = {
  threadListBody: 'fb_dtsg=TOKEN&doc_id=1&variables=' + encodeURIComponent('{"folder":"inbox"}'),
  messageListBody:
    'fb_dtsg=TOKEN&doc_id=2&variables=' +
    encodeURIComponent('{"thread_fbid":"OLD","min_uq_seq_id":null}'),
  headers: { 'x-csrftoken': 'TOKEN' },
  cursorVariable: 'after',
};

test('sessionFromCapturedForms injects thread id and cursor, preserving other fields', () => {
  const session = sessionFromCapturedForms(capture);
  const messages = new URLSearchParams(session.listMessages('NEW', 'CUR').body);
  assert.deepEqual(JSON.parse(messages.get('variables')!), {
    thread_fbid: 'NEW',
    min_uq_seq_id: null,
    after: 'CUR',
  });
  assert.equal(messages.get('fb_dtsg'), 'TOKEN'); // untouched captured fields survive
  assert.equal(messages.get('doc_id'), '2');

  const threads = new URLSearchParams(session.listThreads().body);
  assert.deepEqual(JSON.parse(threads.get('variables')!), { folder: 'inbox' });
});

test('sessionFromCapturedForms omits the cursor when no variable name is given', () => {
  const { cursorVariable: _omitted, ...noCursor } = capture;
  const session = sessionFromCapturedForms(noCursor);
  const body = new URLSearchParams(session.listThreads('CUR').body);
  assert.deepEqual(JSON.parse(body.get('variables')!), { folder: 'inbox' });
});

test('sessionFromCapturedForms rejects a capture it cannot parse', () => {
  assert.throws(
    () => sessionFromCapturedForms({ ...capture, threadListBody: 'fb_dtsg=T' }).listThreads(),
    /no variables field/,
  );
  assert.throws(
    () => sessionFromCapturedForms({ ...capture, threadListBody: 'variables=notjson' }).listThreads(),
    /not valid JSON/,
  );
});
