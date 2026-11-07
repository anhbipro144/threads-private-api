import assert from 'node:assert/strict';
import test from 'node:test';
import { markThreadRead } from '../../src/threads-dm-send.ts';
import { ThreadsAuthRequiredError } from '../../src/threads-dm-read.ts';

// Invented values; shape follows the captured mark-read request (E16-E18-SDK-LIVE-20261107).
function capture(variables: unknown = { thread_fbid: 'thread-A', timestamp_ms: '1000' }, name = 'WmiSlideThreadMutationsMarkReadMutation') {
  return {
    body: new URLSearchParams({ doc_id: '123456', fb_api_req_friendly_name: name, fb_dtsg: 'synthetic-token', variables: JSON.stringify(variables) }).toString(),
    headers: { cookie: 'synthetic-cookie', 'content-type': 'application/x-www-form-urlencoded' },
  };
}

const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

test('one request keeps the captured chat and session, with timestamp_ms set to now', async () => {
  const calls: RequestInit[] = [];
  const before = Date.now();
  await markThreadRead({ capture: capture(), fetchImpl: (async (_url: string, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ data: { slide_mark_thread_read: {} } }));
  }) as typeof fetch });
  assert.equal(calls.length, 1);
  const form = new URLSearchParams(String(calls[0]!.body));
  const variables = JSON.parse(form.get('variables')!);
  assert.equal(variables.thread_fbid, 'thread-A');
  assert.ok(Number(variables.timestamp_ms) >= before && typeof variables.timestamp_ms === 'string');
  assert.equal(form.get('fb_dtsg'), 'synthetic-token');
  assert.equal(calls[0]!.redirect, 'error');
  assert.deepEqual(calls[0]!.headers, capture().headers);
});

test('rejects other captures before any request', async () => {
  const fetchImpl = (async () => assert.fail('no request expected')) as typeof fetch;
  for (const bad of [capture(undefined, 'WmiSlideTextMessageMutation'), capture({ timestamp_ms: '1' }), capture({ thread_fbid: 'thread-A', extra: 1 })]) {
    await assert.rejects(markThreadRead({ capture: bad, fetchImpl }), /expected a captured mark-read form/);
  }
});

test('auth rejections, HTTP failures and unexpected responses throw without the body', async () => {
  await assert.rejects(markThreadRead({ capture: capture(), fetchImpl: reply(403, {}) as typeof fetch }), ThreadsAuthRequiredError);
  await assert.rejects(markThreadRead({ capture: capture(), fetchImpl: reply(200, { error: 1357054 }) as typeof fetch }), ThreadsAuthRequiredError);
  await assert.rejects(markThreadRead({ capture: capture(), fetchImpl: reply(500, { secret: 'x' }) as typeof fetch }), (e: Error) => e.message === 'Threads mark read: HTTP 500');
  await assert.rejects(markThreadRead({ capture: capture(), fetchImpl: reply(200, { data: { other: {} } }) as typeof fetch }), /unexpected response/);
});
