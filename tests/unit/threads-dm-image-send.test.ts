import assert from 'node:assert/strict';
import test from 'node:test';
import { ThreadsImageSendAttempt, ThreadsImageUploadError, ThreadsSendOutcomeUnknownError } from '../../src/threads-dm-send.ts';

// Invented values; shape follows the observed upload and WmiSlideMediaMessageMutation (E17).
function capture() {
  return {
    body: new URLSearchParams({
      av: 'actor-A', __user: 'actor-A', __a: '1', fb_dtsg: 'synthetic-token', lsd: 'synthetic-lsd', jazoest: '1',
      doc_id: '654321', fb_api_req_friendly_name: 'WmiSlideMediaMessageMutation', server_timestamps: 'true',
      variables: JSON.stringify({
        thread_fbid: 'thread-A', offline_threading_id: '12345',
        media: { attachment_type: 'IMAGE', media_fbid: '1' }, replied_to_message_id: null, logging_data: null,
      }),
    }).toString(),
    headers: { cookie: 'synthetic-cookie', 'content-type': 'application/x-www-form-urlencoded', 'x-fb-friendly-name': 'WmiSlideMediaMessageMutation' },
    senderFbid: 'messaging-A',
  };
}
const image = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
// 2^53 + 1 cannot survive JSON.parse as a number; the attempt must keep its digits.
const UPLOAD = 'for (;;);{"payload":{"uploadID":null,"metadata":{"0":{"image_id":9007199254740993,"filename":"image","filetype":"image/png","fbid":9007199254740993,"src":"x"}}}}';

function acknowledgement(init: RequestInit | undefined) {
  const v = JSON.parse(new URLSearchParams(String(init?.body)).get('variables')!);
  return { data: { send_slide_media_message: {
    message_id: 'message-new', timestamp_ms: '1234567', content_type: 'IMAGES',
    as_micg_interface: {
      message_id: 'message-new', timestamp_ms: '1234567', sender_fbid: 'messaging-A',
      thread_fbid: v.thread_fbid, offline_threading_id: v.offline_threading_id, content: { images: [{}] },
    },
  } } };
}

test('uploads once, then sends once with the uploaded ID and a fresh offline ID', async () => {
  const calls: string[] = [];
  const attempt = new ThreadsImageSendAttempt({ capture: capture(), image: image(), fetchImpl: async (url, init) => {
    const u = new URL(String(url));
    calls.push(u.pathname);
    assert.equal(init?.redirect, 'error');
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers.cookie, 'synthetic-cookie');
    if (u.pathname === '/ajax/mercury/upload.php') {
      assert.equal(u.searchParams.get('fb_dtsg'), 'synthetic-token');
      assert(!u.searchParams.has('variables') && !u.searchParams.has('doc_id') && !u.searchParams.has('av'));
      assert(!('content-type' in headers) && !('x-fb-friendly-name' in headers));
      const body = init?.body as FormData;
      assert.deepEqual([...body.keys()], ['farr']);
      return new Response(UPLOAD);
    }
    const v = JSON.parse(new URLSearchParams(String(init?.body)).get('variables')!);
    assert.deepEqual(v.media, { attachment_type: 'IMAGE', media_fbid: '9007199254740993' });
    assert.notEqual(v.offline_threading_id, '12345');
    return new Response(JSON.stringify(acknowledgement(init)));
  } });
  const ack = await attempt.send();
  assert.equal(ack.messageId, 'message-new');
  assert.equal(ack.mediaFbid, '9007199254740993');
  assert.deepEqual(calls, ['/ajax/mercury/upload.php', '/api/graphql']);
  await assert.rejects(attempt.send(), /consumed/);
  assert.equal(calls.length, 2);
});

test('rejects unsupported captures and empty images before any request', () => {
  for (const edit of [
    (v: Record<string, any>) => { v.media.attachment_type = 'VIDEO'; },
    (v: Record<string, any>) => { v.replied_to_message_id = 'reply'; },
    (v: Record<string, any>) => { v.extra = 1; },
  ]) {
    const c = capture(), f = new URLSearchParams(c.body), v = JSON.parse(f.get('variables')!);
    edit(v); f.set('variables', JSON.stringify(v)); c.body = f.toString();
    assert.throws(() => new ThreadsImageSendAttempt({ capture: c, image: image() }), /single-image/);
  }
  assert.throws(() => new ThreadsImageSendAttempt({ capture: capture(), image: new Blob([]) }), /nonempty image/);
});

test('upload failures send no message; send failures are unknown outcomes', async () => {
  for (const reply of [new Response('x', { status: 500 }), new Response('for (;;);{"payload":null}')]) {
    let sends = 0;
    const attempt = new ThreadsImageSendAttempt({ capture: capture(), image: image(), fetchImpl: async url => {
      if (String(url).includes('/api/graphql')) sends++;
      return reply;
    } });
    await assert.rejects(attempt.send(), (e: unknown) => e instanceof ThreadsImageUploadError);
    assert.equal(sends, 0);
  }
  const attempt = new ThreadsImageSendAttempt({ capture: capture(), image: image(), fetchImpl: async url =>
    String(url).includes('upload.php') ? new Response(UPLOAD) : new Response('{"data":{}}') });
  await assert.rejects(attempt.send(), (e: unknown) => e instanceof ThreadsSendOutcomeUnknownError && e.httpStatus === 200);
});
