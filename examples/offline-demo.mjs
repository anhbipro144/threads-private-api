import assert from 'node:assert/strict';
import { ThreadsDmReader } from 'threads-private-api';

let syntheticRequests = 0;
const reader = new ThreadsDmReader({
  minIntervalMs: 0,
  session: {
    listThreads: () => ({ body: 'inbox', headers: {} }),
    listMessages: () => ({ body: 'messages', headers: {} }),
  },
  fetchImpl: async (_url, init) => {
    syntheticRequests++;
    const data = init.body === 'inbox'
      ? { get_slide_mailbox_for_iris_subscription: { threads_by_folder: { edges: [{ node: { id: 'demo-thread' } }] } } }
      : { get_slide_thread: { messages: { edges: [{ node: { as_micg_interface: {
        message_id: 'demo-message', thread_fbid: 'demo-thread', sender_fbid: 'demo-sender',
        timestamp_ms: '1000', content: { text_body: 'Synthetic demonstration' },
      } } }] } } };
    return new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });
  },
});
const inbox = await reader.listThreads();
const page = await reader.listMessages(inbox.threads[0].id);
assert.equal(inbox.threads.length, 1);
assert.equal(page.messages.length, 1);
assert.equal(syntheticRequests, 2);
reader.disconnect();
console.log(JSON.stringify({ conversations: inbox.threads.length, messages: page.messages.length, liveRequests: 0, messagesSent: 0 }));
