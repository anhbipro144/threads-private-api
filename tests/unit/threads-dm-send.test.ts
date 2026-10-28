import assert from 'node:assert/strict';
import test from 'node:test';
import { ThreadsTextSendAttempt, ThreadsSendOutcomeUnknownError } from '../../src/threads-dm-send.ts';

// Invented values; shape follows the controlled send request and acknowledgement.
function capture() {
  return {
    body: new URLSearchParams({
      av: 'actor-A', doc_id: '123456', fb_api_req_friendly_name: 'WmiSlideTextMessageMutation',
      fb_dtsg: 'synthetic-token', variables: JSON.stringify({
        text_body: { sensitive_string_value: 'old synthetic draft' }, recipient_fbids: null,
        thread_fbid: 'thread-A', offline_threading_id: '12345', replied_to_message_id: null,
        forwarded_message_id: null, send_silently: false, mentioned_users: null, logging_data: null,
      }),
    }).toString(),
    headers: { cookie: 'synthetic-cookie', 'content-type': 'application/x-www-form-urlencoded' },
    senderFbid: 'messaging-A', // The observed messaging sender is not the form actor.
  };
}

function acknowledgement(init: RequestInit | undefined) {
  const variables = JSON.parse(new URLSearchParams(String(init?.body)).get('variables')!);
  return { data: { send_slide_text_message: {
    message_id: 'message-new', timestamp_ms: '1234567', content_type: 'TEXT',
    as_micg_interface: {
      message_id: 'message-new', timestamp_ms: '1234567', sender_fbid: 'messaging-A',
      thread_fbid: variables.thread_fbid, offline_threading_id: variables.offline_threading_id,
      content: { text_body: variables.text_body.sensitive_string_value },
    },
  } } };
}

test('one attempt preserves scope/session, uses a fresh ID, and validates the full acknowledgement', async () => {
  const original = capture();
  let calls = 0;
  const attempt = new ThreadsTextSendAttempt({ capture: original, text: 'new synthetic draft', fetchImpl: async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://www.threads.com/api/graphql');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert(init?.signal);
    assert.equal((init.headers as Record<string, string>).cookie, 'synthetic-cookie');
    const before = new URLSearchParams(original.body), after = new URLSearchParams(String(init.body));
    for (const [key, value] of before) if (key !== 'variables') assert.equal(after.get(key), value);
    const v = JSON.parse(after.get('variables')!);
    assert.equal(v.thread_fbid, 'thread-A');
    assert.equal(v.text_body.sensitive_string_value, 'new synthetic draft');
    assert.notEqual(v.offline_threading_id, '12345');
    assert(BigInt(v.offline_threading_id) > 0n && BigInt(v.offline_threading_id) < (1n << 63n));
    return new Response('for(;;);' + JSON.stringify(acknowledgement(init)));
  } });
  original.headers.cookie = 'mutated';
  assert.equal(calls, 0);
  const [first, second] = await Promise.allSettled([attempt.send(), attempt.send()]);
  assert.equal(first.status, 'fulfilled');
  if (first.status === 'fulfilled') assert.equal(first.value.messageId, 'message-new');
  assert.equal(second.status, 'rejected');
  await assert.rejects(attempt.send(), /consumed/);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(attempt), '{}');
});

test('rejects unsupported scope and malformed captures before any request', () => {
  for (const edit of [
    (v: Record<string, unknown>) => { v['recipient_fbids'] = ['new-recipient']; },
    (v: Record<string, unknown>) => { v['send_silently'] = true; },
    (v: Record<string, unknown>) => { v['replied_to_message_id'] = 'reply'; },
    (v: Record<string, unknown>) => { v['unknown'] = 'extra'; },
    (v: Record<string, unknown>) => { delete v['mentioned_users']; },
  ]) {
    const c = capture(), f = new URLSearchParams(c.body), v = JSON.parse(f.get('variables')!);
    edit(v); f.set('variables', JSON.stringify(v)); c.body = f.toString();
    assert.throws(() => new ThreadsTextSendAttempt({ capture: c, text: 'draft' }), /captured plain-text/);
  }
  for (const text of ['', '   ']) assert.throws(() => new ThreadsTextSendAttempt({ capture: capture(), text }), /nonempty/);
  for (const body of ['variables=private-invalid-json', capture().body + '&variables=%7B%7D']) {
    assert.throws(() => new ThreadsTextSendAttempt({ capture: { ...capture(), body }, text: 'draft' }), /Threads send:/);
  }
});

test('mismatched message echoes are unknown outcomes and cannot be retried', async () => {
  for (const field of ['thread_fbid', 'sender_fbid', 'offline_threading_id', 'message_id', 'timestamp_ms', 'content']) {
    let calls = 0;
    const attempt = new ThreadsTextSendAttempt({ capture: capture(), text: 'draft', fetchImpl: async (_url, init) => {
      calls++;
      const result = acknowledgement(init);
      Object.assign(result.data.send_slide_text_message.as_micg_interface, { [field]: 'private-mismatched-value' });
      return new Response(JSON.stringify(result));
    } });
    await assert.rejects(attempt.send(), (e: unknown) => {
      assert(e instanceof ThreadsSendOutcomeUnknownError);
      assert.equal(e.httpStatus, 200);
      assert(!e.message.includes('private-mismatched-value'));
      return true;
    });
    await assert.rejects(attempt.send(), /consumed/);
    assert.equal(calls, 1);
  }
});

test('network, HTTP, and malformed provider failures stay sanitized and consume the attempt', async () => {
  for (const [status, payload] of [
    [null, 'private-network-error'], [401, 'private-response'], [403, 'private-response'], [429, 'private-response'],
    [200, 'private-malformed-json'], [200, '{"error":1357054}'],
    [200, '{"errors":[{"message":"private-error"}],"data":{}}'], [200, '{"data":{}}'],
  ] as const) {
    let calls = 0;
    const attempt = new ThreadsTextSendAttempt({ capture: capture(), text: 'draft', fetchImpl: async () => {
      calls++;
      if (status === null) throw new Error(payload);
      return new Response(payload, { status });
    } });
    await assert.rejects(attempt.send(), (e: unknown) => {
      assert(e instanceof ThreadsSendOutcomeUnknownError);
      assert.equal(e.httpStatus, status);
      assert.equal(e.reconnectRequired, status === 401 || status === 403 || payload === '{"error":1357054}');
      assert(!String(e).includes('private-'));
      assert.equal(e.cause, undefined);
      return true;
    });
    await assert.rejects(attempt.send(), /consumed/);
    assert.equal(calls, 1);
  }
});
