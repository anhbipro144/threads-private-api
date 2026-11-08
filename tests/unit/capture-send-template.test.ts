import assert from 'node:assert/strict';
import test from 'node:test';
import { captureSendTemplate, SEND_TEMPLATE_PLACEHOLDER } from '../../scripts/capture-send-template.ts';
import { ThreadsTextSendAttempt } from '../../src/threads-dm-send.ts';
import type { ThreadListPage } from '../../src/threads-dm-read.ts';

const inbox: ThreadListPage = { threads: [{ id: 'chat-A', members: [
  { id: 'customer-id', username: 'customer', name: 'Customer', avatarUrl: null },
  { id: 'shop-sender-id', username: 'shop', name: 'Shop', avatarUrl: null },
] }], pageInfo: { hasNextPage: false, endCursor: null } };
const typedText = 'synthetic owner text with spaces & symbols';
function request(edit: Record<string, unknown> = {}, operation = 'WmiSlideTextMessageMutation') {
  return { headers: { cookie: 'synthetic-cookie' }, body: new URLSearchParams({
    doc_id: '123456', fb_api_req_friendly_name: operation, variables: JSON.stringify({
      text_body: { sensitive_string_value: typedText }, recipient_fbids: null,
      thread_fbid: 'chat-A', offline_threading_id: '12345', replied_to_message_id: null,
      forwarded_message_id: null, send_silently: false, mentioned_users: null, logging_data: null,
      ...edit,
    }),
  }).toString() };
}

test('captures a reusable send template without text, mutation or any send request', () => {
  const original = request();
  const result = captureSendTemplate(original, inbox, 'shop', 'chat-A');
  assert('send' in result);
  assert.equal(result.send.senderFbid, 'shop-sender-id');
  assert.equal(JSON.parse(new URLSearchParams(result.send.body).get('variables')!).text_body.sensitive_string_value, SEND_TEMPLATE_PLACEHOLDER);
  assert(!decodeURIComponent(result.send.body.replaceAll('+', ' ')).includes(typedText));
  assert(!JSON.stringify(result).includes(typedText));
  assert.equal(JSON.parse(new URLSearchParams(original.body).get('variables')!).text_body.sensitive_string_value, typedText);
  original.headers.cookie = 'changed';
  assert.equal(result.send.headers.cookie, 'synthetic-cookie');
  new ThreadsTextSendAttempt({ capture: result.send, text: 'future reply', threadId: 'chat-B',
    fetchImpl: async () => { assert.fail('constructing must never send'); },
  });
});

test('refuses wrong chat, quoted, mentioned, photo and malformed requests with value-free reasons', () => {
  for (const captured of [
    request({ thread_fbid: 'chat-B' }), request({ replied_to_message_id: 'private-quote' }),
    request({ mentioned_users: ['private-mention'] }), request({}, 'WmiSlideMediaMessageMutation'),
    { headers: {}, body: 'variables=private-invalid-json' },
    { ...request(), body: request().body + '&variables=%7B%7D' },
  ]) {
    assert.deepEqual(captureSendTemplate(captured, inbox, 'shop', 'chat-A'), { reason: 'sendTemplateUnusable' });
  }
});

test('refuses an unconfirmed sender without falling back to another member or form actor', () => {
  assert.deepEqual(captureSendTemplate(request(), inbox, 'absent-shop', 'chat-A'), { reason: 'senderUnconfirmed' });
  assert.deepEqual(captureSendTemplate(request(), { ...inbox, threads: [] }, 'shop', 'chat-A'), { reason: 'senderUnconfirmed' });
});
