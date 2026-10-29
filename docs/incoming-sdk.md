# Incoming text receiver

`ThreadsDmIncoming` extracts the path reproduced by the private research
prototype in E5-NODE-PUSH-20261029. In E5-SDK-PUSH-20261029, the compiled SDK
received one new controlled message and matched a separate Node read, after
DevTools disconnected and its owned observation tab closed. One callback was
observed. Synthetic tests additionally cover the failure and shutdown paths.
This is an undocumented Threads web-client interface, not an official Meta API.

```ts
import { ThreadsDmIncoming } from 'threads-private-api';

const receiver = new ThreadsDmIncoming({
  session: freshCapturedSession,
  threadId: agreedTestThreadId,
  seenMessageIds: baseline.messages.map(message => message.messageId),
  onMessage(message) {
    updateOwnerInbox(message);
  },
});

try {
  await receiver.start(); // waits for stream, setup acknowledgement and subscription
  await receiver.closed; // resolves after stop(); rejects on an unexpected failure
} catch (error) {
  // Surface a reconnect/status prompt to the owner. Do not log session material.
  showOwnerConnectionStatus(error);
} finally {
  receiver.stop();
}
// The host must call receiver.stop() when its connection is no longer needed.
```

The host supplies `ThreadsIncomingSession` in memory:

- `url`: the exact observed version-5 Lightspeed connection URL, including its
  captured app/device/account query values. Only `wss://gateway.threads.com`
  with path `/ws/lightspeed` and the observed `6:0` auth type is accepted.
- `cookie` and `userAgent`: from the same current owner-authenticated capture.
  The Node connection also uses the observed Threads origin. These values and
  the URL belong only in the owner's backend, never frontend, Git or logs.
- `initialPackets`: exact first browser send packets for that connection, as
  `Uint8Array`s. The supported captured branch contains an empty-header establish
  frame followed by one acknowledged type-2 subscription for database 231.
  Preserve its request/device/sequence/configuration values. The receiver copies
  these packets and replays them once after the gateway's first pong. It does not
  manufacture a cursor, device, subscription or authentication value.

The host verifies account identity and the agreed conversation when collecting
the session. A subscription can contain mailbox-wide deltas; the receiver filters
to `threadId` before parsing or delivering message content. It does not return
other conversations, raw envelopes, non-message deltas or provider error text.
Only text messages are supported, including owner-originated messages in that
conversation. Incoming events are not permission to send replies.

`start()` is idempotent while connecting/ready. States are `configured`,
`connecting`, `ready`, `stopped`, `failed`. `stop()` works before readiness,
clears timers/listeners/session references/buffers and prevents further callbacks.
Stopped or failed instances cannot reconnect; make a new instance with fresh
owner-supplied session state after reconciling missed messages using the reader.
No automatic reconnect, resnapshot, credential renewal or provider retry exists.
Callbacks run in arrival order; asynchronous callback completion is not serialized.
Throwing or rejecting a callback stops the receiver without replaying that event.

Within one connection, message IDs are suppressed after first delivery; conflicting
repeated text-message representations stop the connection. `seenMessageIds` can
seed suppression from a separately read baseline. This is local behavior, not
evidence about provider duplicate/order guarantees or cross-restart exactly-once
delivery. Message content is not retained for deduplication; only its hash and ID.
Non-message edits/reactions/deletes do not update already displayed messages.

Local resource limits are conservative: 1 MiB per frame, 2 MiB for a received
buffer, 4096 frames/fields/deltas per parsed batch and 10000 known message IDs.
Exceeding a bound stops instead of dropping validation or forgetting dedupe state.
Initial capture is limited to 32 KiB/four send packets. Startup has a 20-second
deadline; keepalive sends every 10 seconds and stops after 30 seconds without
received traffic. These are client bounds, not discovered platform limits.

`ThreadsIncomingError.reason` is value-free: `invalid-session`,
`protocol-rejected`, `reconnect-required`, `connection-failed`, `timeout`,
`stopped`, `callback-failed`. Authentication versus other connection errors
cannot always be distinguished. Resnapshot/failure operations and explicit
deauthorization require manual reconciliation. Unsupported frame/protocol
variants fail closed. No claim of complete protobuf-schema coverage follows.

Validation covers chunk boundaries, setup correlation, stream IDs, malformed
base64/protobuf and size bounds, scope filtering, local deduplication, callback
failures, early/late stop and timeout cleanup. Default Node 24 headers support
was exercised by both the earlier prototype and the bounded compiled-SDK live
test. Browser-closed push, long-running use, genuine expiry and recovery remain
unverified. A new live message requires fresh exact approval. Website
integration, deployment and platform compliance review remain separate work.
