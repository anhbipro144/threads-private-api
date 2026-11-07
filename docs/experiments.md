# Experiment register and rules

Updated 2026-10-28. Authenticated inbox and selected-conversation reads have been
reproduced in Node with Chrome closed and matched against fresh browser baselines.
The owner authorized one exact UI draft from controlled Account A to Account B,
and independently confirmed exactly one receipt on B.

## Rules

- Three owner-controlled test accounts only (see `AGENTS.md`); inspect only their
  agreed test chats.
- Begin with read-only observation; owner handles sign-in and challenges.
- Always attach to the owner's existing remote-debugging Chrome with
  `--autoConnect`, per the owner's explicit preference. Do not launch another
  isolated browser or request another sign-in there.
- Store private captures/state outside this repository and outside context-mode's
  persistent knowledge base. Use owner-selected private storage with mode 0700
  directories / 0600 files. Avoid raw HAR export unless strictly necessary.
- Record header names and sanitized shapes, never cookies, tokens, message text,
  account handles/IDs, query-bearing private URLs, or full authenticated bodies.
- One controlled action per observation; initial standalone reads: one request
  at a time with at least 5 seconds between manual experiments, no automatic
  polling loop. Record provider rate signals; this is a research bound, not a
  discovered platform rate limit.
- Sending is disabled until the owner authorizes exact test sender, recipient,
  content and count. Use one unique test message, then independently check receipt.
- No automatic uncertain-send retry. Timeout, dropped response, or malformed ack
  means unknown outcome until reconciled with the receiving test account.
- Stop on login challenge, unexpected account content, or access-control barrier.
  Do not bypass security or broaden account/recipient scope.

## Latest sending receipt checkpoint (2026-10-28)

### E11-NON-TEXT-20261107 — image, link and shared-post shapes in live deltas

The owner approved three customer-to-shop messages and sent each by hand: one image,
one link and one shared own post. The agent sent nothing. A temporary in-page listener
in the owner's Chrome kept only field names and types, restricted to the agreed chat.
No text, IDs, URLs or raw frames were kept, and a reload removed the listener.

All three arrived as `SlideUQPPNewMessage`, each followed by `SlideUQPPMarkRead`,
with no parser errors and no entries from other chats. **OBSERVED**, one message each:

| Type | `content_type` | `content.__typename` | Useful fields |
| --- | --- | --- | --- |
| Image | `IMAGES` | `THMessageImagesContent` | `images[]`: `attachment_cdn_url`, `width`, `height`, preview variants |
| Link | `MESSAGE_INLINE_SHARE` | `THMessageXMAContent` | `xma_text_body`, `xma` title, subtitle and `target_url` |
| Shared post | `TEXT_POST_APP_LINK_XMA` | `THTextPostAppLinkXMA` | `content_ref.media_igid`, `owner_igid`, `xma.caption_body_text`, `threads_post_json` |

Every message also carried `as_micg_interface.sender` with `name`, `username` and
`profile_pic_uri`, the lead for customer identity. A link's text is not in `text_body`.

**Not established in E11:** the message-list read shape, because reload and reopening
served chat data from page or client cache. The SDK run below covers reads.

### E11-SDK-NON-TEXT-20261107 — compiled SDK reads and receives an image and a shared post

The owner approved two customer-to-shop messages in the agreed chat, one plain test
image and one share of their own test post, and sent each by hand. The agent sent
nothing. A private helper outside the repo attached to the owner's Chrome, confirmed
the shop account, opened its own background tab, and opened the agreed chat from the
mailbox so that `BarcelonaMessageListContainerQuery` fired. It captured that request
and the incoming setup in memory, closed its tab, and disconnected DevTools before
the SDK connected. Output was sanitized; nothing was saved.

**REPRODUCED** with built `dist/index.js`:

- **Read shape.** Images in a read use `THMessageImagesContent`, the same as live
  deltas. Shared posts (`THTextPostAppLinkXMA`) and links (`THMessageXMAContent`)
  in reads also carry `text_body`, which deltas lack. The first read parsed the
  shared post as `text`. The parser now checks the image and shared-post types before
  `text_body`, and a second read returned `shared-post`. **Links read as `text` but
  arrive live as `unsupported`.**
- **Receiver.** Two callbacks, `image` then `shared-post`, with no duplicates over a
  further 20 seconds. Each matched a separate Node read. The image URL differed
  between the callback and the read, as expected by the dedupe digest.
- **Images.** CDN URLs from the read and from the callback returned HTTP 200
  `image/png` without cookies, shortly after delivery. Their lifetime is untested.
- **Caption.** Both shared posts reported `caption: "post"`, which the owner
  confirmed is the shared post's text.
- The browser sent the stream establish and subscribe frames in one packet; earlier
  runs saw two. `ThreadsDmIncoming` accepted either.

Not checked: multi-image messages, long-running use, story replies, video, voice and
stickers. The approvals for both messages are consumed.

### E19-REUSED-SETUP-20261107 — a second receiver from 5-minute-old setup packets

The owner approved one customer-to-shop text in the agreed chat and sent it by hand,
then unsent it. The agent sent nothing. The same private helper captured the session
and incoming setup once, closed its tab and disconnected DevTools. A first
`ThreadsDmIncoming` reached `ready` and was stopped. After a 300-second gap, a new
instance using **the same captured packets**, with no browser step, reached `ready`
(packet age 315 seconds) and delivered one `text` callback when the owner sent.

**REPRODUCED, once:** replaying an unchanged setup on a new connection after a stop.
A later read did not contain the message because the owner had unsent it, so the
callback was matched only by timing and the owner's report. The unsend produced no
callback. Not established: how old a setup can be, behaviour after a provider drop,
or after the browser closes. A Node-built setup (new cursor or request ID) was not tried.

### E14-NEW-CHAT-20261107 — a new customer's first message

In the same run, the owner approved one first text from the third test account to
the shop, a new chat, and sent it by hand. The shop's app showed it under **Message
requests**, not the inbox. The receiver only describes its one agreed chat; a tap on
the same connection counted entries from any other chat by type only, and described
only the third account's entries by structure.

**Not observed:** the tap saw no entries from any other chat, of any type, during the
connection. When the message arrived relative to the connection's end is unclear, so
this does not yet show that request-folder messages are absent from the subscription.
Not checked: the request read shape, accepting a request, or replying to one.

**Rerun, same day.** The receiver connected from a fresh capture first, then the owner
sent a second first-chat text by hand on the agent's signal. It again showed under
Message requests. Over 15 minutes the connection stayed `ready` and received 94
frames, but no entry from the request chat or any other chat. **OBSERVED:** this
subscription, as captured from the browser's open chat, does not carry messages in
Message requests. Not established: whether another subscription, a folder read, or
accepting the request would make them visible.

**Requests page, same day (no messages).** In an owned background tab, the helper
opened `/messages/requests` from the mailbox. **OBSERVED** in the browser:

- `BarcelonaMessagesThreadListMailboxQuery` with `folder: "PENDING"`, then
  `BarcelonaMessagesThreadListPaginationQuery` with `folder: "PENDING"`. This is
  the same inbox-list query with a different folder value.
- `WmiSlideMailboxMutationsMarkFolderSeenMutation` fired on opening the page, so
  opening Requests clears its badge. No chat was opened, nothing was accepted.
- No new WebSocket opened. The page listed the request chat.

Whether the `PENDING` response itself contained the request chat was not captured
(output truncated; a rerun was stopped by the open-chat check).

**Node read of `PENDING`, same day (no messages).** The helper captured the browser's
`PENDING` mailbox request, closed its tab and disconnected DevTools. The browser
response contained one thread, the request chat. `ThreadsDmReader.listThreads()` with
that captured body returned **the same single thread ID**, without the agreed inbox
chat and with no next page. **REPRODUCED:** a backend can list Message requests by
reading the inbox-list query with `folder: "PENDING"`. The Node read did not send
the mark-seen mutation.

**Node read of a request chat's messages, same day (no messages).** The helper also
captured the agreed chat's `BarcelonaMessageListContainerQuery` form. In Node,
`listThreads()` on `PENDING` returned the one request chat, and `listMessages()` on
its ID, with only `thread_fbid` substituted, returned both first-chat texts from the
customer, one sender, all in that thread. **REPRODUCED:** a backend can read a
request chat's messages before accepting it, with the message-list form captured
from a different chat (a first data point for E15). No mark-read mutation was sent.

**Accepting, same day.** The owner approved accepting the request and one further
customer text, and did both by hand. The helper captured the session, Message-requests
read and incoming setup, then disconnected DevTools. Polling `PENDING` every 15
seconds, Node saw the request chat leave the folder after the owner accepted. A read
then returned 3 messages instead of 2; the extra item was not inspected. A
`ThreadsDmIncoming` on the accepted chat's ID reached `ready`, and the owner's text
arrived as **one `text` callback with the exact test content, matched by a separate
Node read**, with no duplicate over 20 seconds. **REPRODUCED:** once accepted, a new
customer's chat behaves like any other chat for the receiver. Not observed: the
accept request itself, what the third item is, and replying from the shop.

### E12-IDENTITY-20261107 — where customer name, username and avatar come from

No messages. The helper opened its own tab, captured the agreed chat's message-list
form and the `PENDING` inbox-list form, and disconnected DevTools. The page HTML
contained one other folder value, `INBOX`; the `PENDING` form with `folder: "INBOX"`
returned three inbox chats from Node, including the accepted request chat. Only field
paths and types were printed, never values. **REPRODUCED** in Node:

- **Inbox list** (`threads_by_folder.edges[].node`): `members.nodes[].as_micg_interface`
  has `id`, `igid`, `name`, `username`, `profile_pic_uri`, `is_verified`,
  `linked_ig_user_igid` and `user_dict.id`. Each chat also carries its latest
  messages with a `sender` object, and `read_receipts[].participant_fbid`.
- **Message list** (`get_slide_thread`): `members.nodes[]` and `participants.nodes[]`
  with the same identity fields, and per message `sender_fbid` plus a `sender`
  object with `id`, `name`, `username`, `profile_pic_uri`, `is_verified`.
- So the inbox list alone is enough to show a customer's name, username and avatar.
- **The extra item after accepting** was `unsupported`, content type
  `THMessageXMATContent`, ordered between the second and third test texts. It is
  probably an accept notice; its fields were not inspected.

Not established: which identity field equals `sender_fbid`, whether IDs stay stable
across sessions or name changes, and avatar URL lifetime. The inbox's third chat was
not inspected.

### E14-REPLY-20261107 — replying from the shop to a new customer

The owner approved one text from the shop's account to the third account, in the
request chat accepted earlier. **REPRODUCED** in Node, one attempt, no retry:

- **The send operation ID changed.** The page's public JavaScript now maps
  `WmiSlideTextMessageMutation` (through `WmiSlideTextMessageMutation.threads.graphql`
  and `WmiSlideTextMessageMutation_threadsRelayOperation`) to doc id
  `29354454254221243`, not the `28577421681940194` recorded on 2026-10-28. Its nine
  input fields are unchanged and match what `ThreadsTextSendAttempt` sends. A nearby
  operation also takes `recipient_fbid`; it was not used.
- **No browser send was captured.** The send form was built from a fresh message-list
  form (same shared fields) with the friendly name, the current doc id and the
  observed variables, and `thread_fbid` set to the new chat. The new chat's ID came
  from the inbox list (`folder: "INBOX"`); the shop's messaging sender ID came from
  the shop's own message in the agreed chat.
- `ThreadsTextSendAttempt` validated the acknowledgement (thread, sender, offline
  ID, text echo). A Node read 3 seconds later showed exactly one new item: the
  sent text, from the shop, with the acknowledged message ID.

DevTools stayed attached (one long-lived connection) during the Node calls, and
Chrome was open. Not established: receipt on the third account's side (not checked
by the owner), and how often the doc id changes. Hard-coding a doc id is fragile;
reading it from the page's public JavaScript, as here, worked.

### E17-PHOTO-SEND-20261107 — how sending a photo works

One generated 400×400 PNG test image was sent once from the shop's account to the
third account, through the web UI in the agent's own tab (owner policy of
2026-11-07). Only request shapes were recorded, never image bytes or tokens.
**OBSERVED**, with the result read back in Node (**REPRODUCED** read):

1. **Upload happens on attach, before Send.** `POST /ajax/mercury/upload.php`,
   `multipart/form-data`, file part `farr`; query has the usual page fields
   (`__user`, `__a`, `__req`, `__hs`, `dpr`, `__ccg`, `__rev`, `__s`, `__hsi`, `__dyn`).
   The response (`for (;;);` JSON) has `payload.metadata["0"]` with `image_id`,
   `fbid`, `filename`, `filetype`, `src`. Other form parts after the file were not
   visible (the body view may stop at binary data), so whether `fb_dtsg`/`lsd` are
   form parts is unknown.
2. **Send** is GraphQL `WmiSlideMediaMessageMutation`, doc id `28008426122167348`, with
   variables `thread_fbid`, `offline_threading_id`, `media: {attachment_type,
   media_fbid}`, `replied_to_message_id: null`, `logging_data: null`. The response
   `data.send_slide_media_message` has `message_id`, `timestamp_ms`,
   `content_type` and `as_micg_interface` with sender and `content.images[]`.
3. A Node read of the chat then showed one `image` message, 400×400, with a URL.

Two further attach-only checks repeated step 1 and were removed without sending
(the second removal was confirmed; the first was dropped by closing the tab).
Not established: an SDK upload or media send from Node, which `media_fbid`
source (`fbid` or `image_id`) the send uses, the `attachment_type` value, caption
support, multiple photos, size limits, and receipt on the third account's side.

#### E17 follow-up: hooked UI send and Node photo send

A second UI photo send (one message) ran with an in-page hook on `XMLHttpRequest`. It
showed the upload `FormData` has exactly one part, `farr` (the file); the upload
URL query also carries `fb_dtsg`, `jazoest`, `lsd`, `__csr`, `__comet_req`, `__spin_*`,
`__crn` and others (the DevTools view had hidden them). The send used
`media: {attachment_type: "IMAGE", media_fbid}` with `media_fbid` equal to the
upload's `fbid`, which equalled its `image_id`. One earlier hooked run did not click
Send; its draft was dropped by closing the tab, and nothing was sent.

Then `ThreadsImageSendAttempt` sent one generated 400×400 PNG from Node into the same
chat. Its form was built from a fresh message-list form with the media mutation's
name, doc id `28008426122167348` (confirmed in the page's public JavaScript, with
input fields `thread_fbid`, `offline_threading_id`, `media`, `replied_to_message_id`,
`logging_data`), and the new chat's ID. One upload and one send; the acknowledgement
validated, and a Node read showed exactly one new item: an image, 400×400, from the
shop, with the acknowledged message ID. **REPRODUCED.** DevTools stayed attached
and Chrome was open. Not checked: receipt on the third account's side, JPEG or
large files, captions, several photos.

### E18-QUOTE-REPLY-20261107 — quote replies

In the second test chat, the shop quoted the third account's latest text twice:
once through the web UI in the agent's own tab, once from Node. One message each.

- **UI (OBSERVED):** hovering a message shows three buttons (a popup, an unlabeled one, "More");
  the plain button opens "Replying to <user>" above the composer. Send used the
  normal `WmiSlideTextMessageMutation` (doc id `29354454254221243`) with
  `replied_to_message_id` set to the quoted message's `message_id` (`mid.$…`), equal
  to the reader's `messageId`. Typing also sent `WmiSlidePublishTypingIndicatorMutation`
  (doc id `29129012240068718`, `thread_id`, `activity_status`, `ttl`).
- **Reads:** a quote reply's node has `replied_to_message` with `message_id`, `id`,
  `sender_fbid`, `sender` and `content.text_body`.
- **Node (REPRODUCED):** `ThreadsTextSendAttempt` with `replyToMessageId` sent one quote
  reply; the acknowledgement validated and a read showed exactly one new item, from
  the shop, quoting the right message. `parseMessageList` now returns
  `repliedToMessageId`; a live read gave it on both quote replies and on no other message.
- **Also seen:** the item added on accepting a request (E14) is the notice
  "You accepted a message request from <user>".

Opening a chat with nothing unread sent no mark-read mutation. Not established:
mark-read (needs an unread customer message), whether SDK reads mark a chat read,
quote replies in live deltas, and quoting photos.

### E5-SDK-FRESH-RECONNECT-20261029 — fresh manual connection received a new message

After the earlier bounded test expired, the owner explicitly opted into a new
receive check without repeating the 15-minute wait. This is a separate experiment;
no callback state or result from the expired process was reconstructed. The
previous message was not resent. A new ten-minute response window was used.

Session 2154 imported built `dist/index.js`, verified the same controlled owner,
captured fresh exact setup/session and scoped baseline in memory, closed its
owned observation tab and disconnected DevTools. A fresh `ThreadsDmIncoming`
accepted its subscription following prior clean shutdown. After readiness, the
owner independently chose/reviewed/sent exactly one NEW unique B→A text in the
agreed chat and reported sent. No agent DM, auto-reply or send retry.

One explicit `check-incoming` compared a single SDK event to the single new
message returned by a separate Node read, with ID/sender/time/text matching in
memory. Output: `sdkIncomingMatchedNodeRead:true`, `sdkCallbackCount:1`,
`usingBuiltPackage:true`, `newScopedMessages:1`, `devtoolsDisconnected:true`,
`browserObservationTabClosed:true`, `messagesSentByAgent:0`,
`credentialsSaved:false`. The SDK stopped; controller exited 0 without a failure
diagnostic and discarded private state. No message contents/IDs/session/frames
saved. This new action/comparison is consumed; no further send authorized.

Confidence: **REPRODUCED** one fresh-manual-connection incoming event and read
comparison. This supplies the previously missing follow-up receive evidence,
while the earlier expired message remains unverified. It is not automatic
reconnection or a provider duplicate guarantee. Browser-closed push, genuine
expiry, power-loss/restart reconciliation and production reliability remain
unverified. SDK code unchanged; last checks remain 66 tests/typecheck/build pass.
Only sanitized documentation changed; no commit, push, website or deployment.

### E5-SDK-SOAK-RECOVERY-20261029 — idle listening and manual gap recovery

Owner approved a 15-minute listening check followed by controlled stop/manual
reconnection. Compiled `ThreadsDmIncoming` was prepared from fresh in-memory
capture in existing autoConnect Chrome. Owner identity and chat scope checked;
owned tab closed and DevTools disconnected before SDK listening.

The SDK stayed ready for 900 monotonic seconds without failure/reconnection.
Local status commands made no provider requests. Zero new message callbacks
were observed during that idle interval. It stopped cleanly at the deadline.
This establishes **OBSERVED** bounded idle continuity, not activity/load capacity.

After the stop, the owner independently reviewed/sent one new unique B→A gap
message and reported sent. A single explicit Node read recovered exactly one new
message. Fresh Chrome setup and a fresh Node baseline were obtained; the baseline
contained the identical gap message (compared privately in memory). A new SDK
instance, seeded with those IDs, accepted the fresh subscription after its owned
tab closed and DevTools disconnected. **REPRODUCED** one manual gap recovery and
fresh subscription; this was not an automatic reconnect or forced session expiry.

The separately requested final B→A post-reconnect message was not reported within
the five-minute action window. Session 4000 emitted `testExpired:true` in phase
`post-reconnect-ready`, stopped and exited 0. Its final `check-incoming` was never
run. Local pre-expiry statuses showed zero callbacks, but no final message/read/
duplicate comparison was completed. No claim of successful post-reconnect delivery
follows from this run. Owner told not to send the expired pending test action.
The owner later reported sent after the receiver stopped. Actual send timing is
unknown; its planned one-message action is consumed. No retained callback state
exists to compare, no replacement/retry was requested, and no further read was
made. Post-reconnect push delivery remains unverified for this message.

No agent DM or automatic reply, no stored private values/contents/frames, no
login invalidation, no website/deployment/commit. Gap action/read consumed; any
future message needs fresh exact approval and readiness. Helper source outside
Git: `/private/tmp/threads-dgw-sdk-soak.mjs`; private runtime state discarded.
Last code checks unchanged: 66 synthetic tests, typecheck, build pass. SDK code
was unchanged by this experiment; documentation diff check passed.

### E5-SDK-PUSH-20261029 — compiled SDK incoming delivery passed

The owner opted into a separate SDK live test. The private validation helper
imported `ThreadsDmIncoming` from built `dist/index.js`, captured fresh exact
session/setup state from existing autoConnect Chrome and verified controlled
owner identity. A scoped baseline was read once. Its owned observation tab
closed and DevTools disconnected before SDK connection/subscription readiness.
The owner then reviewed/sent one new unique B→A plain-text test message in the
agreed chat and reported sent. No agent DM or automatic reply was sent.

The compiled SDK produced exactly one callback for the new controlled message.
After the action report, a single independent Node read matched the callback's
message ID, sender, timestamp and text in memory. Sanitized output:
`sdkIncomingMatchedNodeRead:true`, `sdkCallbackCount:1`, `usingBuiltPackage:true`,
`newScopedMessages:1`, `devtoolsDisconnected:true`,
`browserObservationTabClosed:true`, `messagesSentByAgent:0`,
`credentialsSaved:false`. Chrome remained open; no browser-closed push claim.

Confidence: **REPRODUCED** for this bounded compiled-SDK incoming delivery and
comparison. Test action and comparison are consumed; no further message is
authorized. Session 64341 received `stop` and exited 0 without the prototype's
generic shutdown-rejection diagnostic. No active receiver/private session remains.
The owner's later message-text statement was not re-read/re-compared after stop;
its contents are not copied into the repository or fixtures.

No credentials, message contents, private URLs or raw frames were logged/saved.
No production deployment or website integration. Long-running use, genuine
expiry, reconnection/reconciliation and general duplicate guarantees remain
unverified. The prior 66 synthetic tests/typecheck/build remain the last offline
checks; this test changed documentation only.

### Incoming SDK extraction — offline 2026-10-29

Owner resumed after the restart checkpoint. Extracted `ThreadsDmIncoming`, the
internal bounded protocol decoder and public exports from the reproduced research
path. The receiver accepts exact caller-captured state, filters one conversation,
deduplicates IDs locally and handles explicit stop/failure without reconnect.
The prototype's ambiguous shutdown diagnostic is addressed in SDK lifecycle
code and synthetic regression tests. No new live test occurred; the previous
message action/comparison remains consumed.

Checks: typecheck, **66 synthetic tests**, build pass. Coverage includes setup
correlation, malformed/fractured/oversized frames and protobuf, scope/stream
rejection, conflicting duplicates, resource caps, callback rejection, terminal
states and timer cleanup. This is implementation/offline validation, not a new
live reproduction or production-readiness claim. Setup: `docs/incoming-sdk.md`.

### E5-NODE-PUSH-20261029 — standalone incoming push reproduced

Owner approved Chrome framing verification followed by a Node receiver.
Metadata-only observation in the agreed controlled conversation identified
version-5 establish/data/ack and ping/pong frames, with no parser rejection or
unfinished data in the bounded check. Owner identity was checked in memory.

Private research helper `/private/tmp/threads-dgw-node-research.mjs` captured
the exact first subscription frames and fresh session headers, then closed its
owned observation tab and disconnected DevTools. It connected to the observed
gateway in Node, replayed the captured setup, handled transport acknowledgements,
and decoded the accepted protobuf subscribe operation. Chrome remained open.
No new device ID, sequence cursor, operation or authentication value was guessed.

After readiness, the owner reviewed and sent exactly one new unique B→A text in
the agreed chat and reported sent. Node decoded the incoming envelope/base64/
LSResponse protobuf delta and filtered `SlideUQPPNewMessage` to the agreed chat.
One explicit independent Node read then matched the single new message's ID,
sender, timestamp and text in memory. No agent message sent. No provider polling,
automatic uncertain-send retry, message text, IDs, credentials or raw frames
were logged/saved. The one-shot comparison and owner action are consumed.

Result: **REPRODUCED** standalone Node subscription and one incoming text event,
matched to a separate read with DevTools disconnected and owned tab closed.
This does not establish browser-closed push, long-running reliability, expiry,
reconnect, general sequence/deduplication semantics or production support.

Tool session 57511 stopped and exited 0 at the owner's restart request. A generic
rejection diagnostic appeared during shutdown after the successful comparison;
review intentional-close classification before extracting SDK code. No retry.
The receiver is still an ephemeral prototype; the repository contains a metadata
classifier only. Last offline checks: typecheck, 56 synthetic tests, build pass.

### E5-INCOMING-20261028 — one controlled incoming message

Hypothesis: an owner-performed B→A message appears in the browser and is readable
through the reproduced Node query; metadata may correlate arrival with a stream.
The owner reviewed/sent one unique plain-text message in the agreed chat and
reported sent. The agent sent nothing and performed no additional send action.

Observer session 75591 had attached through autoConnect, checked owner/chat scope
and retained a ten-message baseline in memory. Its one-shot check found exactly
one new non-A message in Node, matched the fresh browser read, and confirmed the
message was visible in the UI before that research browser read. Chrome stayed
open. No scoped HTTP operation was observed before the research read.

The metadata-only observer recorded 21 Lightspeed frames: 19 of one byte, one of
2281 bytes and one of 353 bytes. Bodies were not captured or decoded; these
sizes do not establish frame semantics or which frame carried the message.
Confidence: **REPRODUCED** for incoming-message retrieval in Node and comparison;
**OBSERVED** for prior UI visibility and correlated stream metadata. Standalone
push, reconnect, sequence handling and deduplication remain unverified.

The check was consumed and the controller stopped with exit code 0. Cleanup
discards private state and closes its owned tab only if draft-free. No secrets,
account identifiers or message contents were saved. No further send authorized.
See `docs/incoming-research.md` for static candidates and remaining work.

### E10-PAGINATION-20261028 — controlled older-page reads

Hypothesis from public client code: message pagination uses a distinct query,
Relay node ID and response root, rather than injecting a cursor into the initial
message query. Scoped to the same controlled owner and agreed conversation.

Fresh initial Node baseline: ten messages and an observed SlideThread node ID.
The normal initial query has a fixed 20-message selection, so no older UI scroll
was available. Research browser requests used the actual persisted pagination
query with first=1: one first page, then one older page via its end_cursor.
Each was reproduced once in Node, at least five seconds between experiments,
and matched in-memory IDs/senders/timestamps/text/page information. Concatenated
page messages matched the first two initial-baseline messages; no duplicates.
Chrome stayed open. No extra messages were created and no send was performed.

The updated SDK then reproduced an initial read and an older-page request,
matching the browser baseline. Confidence: **REPRODUCED** for these bounded reads.
Default-size UI pagination, mailbox pagination, the opposite direction and live
automatic full-history traversal remain unverified. Actual forms/cursors/node IDs
and credentials stayed in memory and were discarded when the controller stopped.
See `docs/message-pagination.md` for operation/shape/provenance and API changes.

### Owner-tested local website milestone and retirement

The owner manually tested the live local application and reported success.
Before shutdown, the runtime reported one provider send attempt. Actual browser
reads and draft preparation had passed through Next → Fastify → Node; the agent
did not click Send during the owner's test. This records owner acceptance of the
website workflow, without inventing a separate acknowledgement/duplicate-count
trace or new explicit B-receipt statement for that manual test.

At the owner's request the loopback servers were stopped, discarding the
in-memory session, and the temporary website integration was removed. The old
test URL is inactive. Reusable adapter code stays in this repository. No new
send is authorized. Full evidence and cleanup boundaries:
`docs/milestones/2026-10-28-local-threads-dm.md`.

### E4-NODE-20261028 — direct Node send and independent receipt

**VERIFIED for this single controlled delivery.** The owner reviewed a distinct
exact unsent Node preview, authorized it once from controlled A to B, and
independently reported B receipt after the test. Session 18158 called the actual
`ThreadsTextSendAttempt.send()` once. It returned a validated acknowledgement;
the helper reported `requestCount: 1`, `acknowledgementAccepted: true`,
`automaticRetry: false`, and no credential storage. No UI Send click was used.
The acknowledgement check requires HTTP 200 and matching thread, messaging
sender, fresh offline ID, text, message ID and timestamp. The helper's separate
`httpStatus` field is null on success because it only records failed attempts;
it does not mean the successful HTTP status was unknown.

Preparation kept session material in memory, verified the owner through a fresh
browser setup request, and reused the reproduced scoped message query in Node.
The messaging sender was bound to the latest confirmed UI marker; the send form
used the observed operation/document ID and nine-variable shape. The original
shared request fields came from the fresh session, not a credential export.
Chrome remained open. Browser-closed sending was not tested.

The exact Node preview was cleared after the attempt to prevent an accidental UI
duplicate. Independent receipt was recorded, the controller stopped, and the
owned tool session is no longer available. No further message is authorized.
No claim of duplicate safety, persisted attempt protection, production release,
session renewal, media support or website send integration follows from this
single result. No live test belongs in ordinary `pnpm test`.

### Follow-up — request and acknowledgement recovered

After fresh exact A→B one-draft approval, observer session 95410 clicked Send
once. One scoped `WmiSlideTextMessageMutation` XHR returned HTTP 200, a nonempty
`data.send_slide_text_message`, and no GraphQL errors. The owner independently
reported B receipt. The approval is consumed. No Node send occurred in that run.

**OBSERVED** variables: `text_body.sensitive_string_value` (string),
`thread_fbid` and `offline_threading_id` (strings), `send_silently` (boolean),
and null `recipient_fbids`, `replied_to_message_id`, `forwarded_message_id`,
`mentioned_users`, `logging_data`. Observed document ID: `28577421681940194`.

The acknowledgement has string `message_id`, `timestamp_ms`, `content_type`
(`TEXT`) and `as_micg_interface`. Its nested thread, offline ID and text matched
the request; nested message ID and timestamp matched the outer acknowledgement.
**The messaging sender ID differs from form `av`.** Do not equate these identity
namespaces. This invalidated an assertion in the temporary Node-phase helper and
ended that controller. Independent receipt remains confirmed. A second existing
DevTools client recovered the captured request/response in memory and checked
these equalities without printing private values. No additional send was needed.

`src/threads-dm-send.ts` now implements an experimental one-attempt text sender
from this observed shape. It fixes the captured conversation, requires the
observed messaging sender, generates a new 63-bit offline ID, validates the full
acknowledgement echo and never retries. Any attempted request with an invalid or
missing acknowledgement has unknown delivery status. Synthetic tests cover
concurrency, consumed attempts, mismatched echoes and sanitized failures.
Typecheck, 30 tests and build passed at that stage. The subsequent Node result is
recorded above.

The older checkpoint below predates this follow-up and does not describe the
now-recovered request/acknowledgement evidence.

The owner confirms that controlled Account B received the exact approved message.
The latest one-message authorization is consumed; no retry or additional message
is authorized. **VERIFIED:** owner-reported receiving-account delivery. The
latest statement alone does not establish duplicate count, UI versus Node
transport, or protocol acknowledgement; do not upgrade those claims from receipt.

The previous observer tool session 71930 is unavailable (`Unknown process id`).
Its in-memory capture cannot be recovered through that session. A temporary
Node-phase helper exists outside Git, but its required repository module
`src/threads-dm-send.ts` is absent. No successful standalone Node send result
was available to verify during this checkpoint. Preserve that evidence gap;
never replay the consumed send to reconstruct it. See `docs/agent-handoff.md`.

## E8 — Private website route stack with live controlled reads (2026-10-28)

Scope: owner's already-authenticated remote-debugging Chrome and the previously
agreed test conversation. The owner authorized website wiring and clarified that
Tailscale allows only their devices; no extra password prompt was added.

Observed defect: the earlier parser expected a string at wire `content`, while
both the historical controlled capture and current response wrap text in
`content.text_body`. The live adapter rejected the response. Version 0.1.1 fixes
that mapping, corrects the synthetic fixture and adds unsupported-content checks.

Final path: compiled private Next GET handler → Fastify injection → Node fetch
of the two reproduced read queries. Compared the allowlisted inbox and agreed
chat against fresh browser baselines, holding all private material in memory.
One allowed conversation and six messages matched, including ordered message
IDs, senders, timestamps, text and page info. A disallowed conversation returned
404 without another provider read. Chrome stayed open. Zero messages sent.

Result: **REPRODUCED** local website read stack with live controlled data.
This was not a request through a deployed website or the actual Tailscale path.
No session values were saved or provisioned to the normal website process.
Production deployment, live device-access rejection and runtime provisioning
remain pending. Offline checks: 26 adapter tests, website synthetic route/config/
proxy tests, typechecks/builds and production dependency bundle checks passed.

## E0 — Public browser/tool readiness (performed)

Discovery ID: E0-PUBLIC-20261027

Hypothesis: an isolated browser can reach Threads without accessing personal state.

Test environment: macOS arm64; project Node 24.22.1; Chrome 156.0.8078.48;
Chrome DevTools MCP 1.12.0, isolated temporary profile, header redaction enabled.

Controlled action: initialize MCP, list pages; navigate example.com, take snapshot,
list/get public network request, evaluate title/origin; navigate Threads and return
only origin/title and login/inbox visibility booleans. Browser closed afterwards.

Observed transport: browser navigation; no authenticated DM traffic.

Endpoint or operation: https://www.threads.com/ (public document only).

Request structure: ordinary browser navigation; no owner credentials provided.

Response structure: rendered page; no DM JSON response observed.

Sanitized evidence: `origin=https://www.threads.com`, `title=Threads`,
`loginVisible=true`, `inboxVisible=false`. All six requested Chrome tools passed.

Independent reproduction: not performed for any DM operation. Tool checks are
reproducible via `pnpm verify:mcp chrome --threads-public` (public network only).

Verification result: public access/tooling passed; authenticated research blocked.

Confidence: OBSERVED.

Known limitations: text visibility booleans are a page heuristic, not a definitive
feature-eligibility test. No session, inbox, messages, or sync traffic observed.

Next action: owner signs in in a reopened native Codex project session; run E1.

## Pending controlled experiments

| ID | Action and evidence required | Status |
| --- | --- | --- |
| E1 Auth | Owner signs in; inspect required header/cookie names and CSRF/request-token flow. Reproduce a verified read in Node with Chrome closed. Observe expiry safely; do not invalidate production state. | Standalone authenticated reads REPRODUCED; expiry and minimum required fields untested |
| E2 Conversations | Open test inbox; correlate one request; record method, operation, parameters, response shape, conversation identity and cursors. Compare standalone read with browser. | REPRODUCED: two thread IDs match fresh browser baseline; pagination untested |
| E3 Messages | Open agreed test conversation; record message/sender IDs, timestamps, ordering, duplicates and pagination. Standalone compare of sanitized results. | REPRODUCED: three ordered messages match browser IDs, senders, timestamps and content; pagination untested |
| E4 Send | After explicit recipient-specific authorization, send one unique test message; capture payload/ack; verify on second account. Reconcile uncertain results manually. Duplicate behavior stays untested unless separately approved. | VERIFIED one authorized UI delivery and independent receipt; wire payload/ack and standalone send remain unverified |
| E5 Incoming | Observe inbox; second account sends one authorized message. Correlate arrival with WS frames/HTTP/SSE/other; use native WS Messages panel if MCP lacks frames. Reproduce without browser; close resources explicitly. | Blocked: two accounts and observed transport |
| E6 Static | Use REA only on publicly delivered resources correlated to E2–E5. Retain resource URL without private queries, hash and source locations. Trace request construction and decoding. | Partial: one public messaging bundle analyzed; graph coverage partial and send path unresolved |
| E7 Recovery | After standalone transport exists, persist a minimal checkpoint atomically; restart; verify no loss/duplicate emission. Simulate expired auth without leaking credentials. | Blocked: standalone implementation |

Do not implement guessed `check-session`, `list-conversations`, `get-messages`,
`send-test-message`, or `sync-messages` scripts before their operations are observed.

## E1–E3 — Authenticated browser reads (partial)

Discovery ID: E123-BROWSER-20261028

Hypothesis: the signed-in web client exposes independently reproducible inbox
and selected-conversation reads.

Test environment: project-pinned Chrome DevTools MCP and Node; owner-requested
attachment to the running Chrome through autoConnect, with header redaction.
This attachment superseded the initial isolated-window procedure for this run.

Controlled action: owner completed authentication and the Messages prompt, then
reported the test conversation selected. Agent inspected the resulting requests.

Observed transport: HTTPS POST GraphQL; no standalone transport established.

Endpoint or operation: https://www.threads.com/api/graphql;
BarcelonaMessagesThreadListMailboxQuery, BarcelonaMessageListContainerQuery,
and WmiSlideAsyncFetchAndInsertThreadQuery.

Request structure: form fields include fb_api_req_friendly_name, variables,
doc_id, fb_dtsg, lsd and jazoest. Mailbox variables include folder and a device
identifier; selected-thread variables include thread_fbid and min_uq_seq_id.
Required authentication fields have not been isolated experimentally.

Response structure: mailbox threads_by_folder and selected-thread messages use
edges plus page_info with start/end cursors and next/previous flags. Message
nodes expose sender, timestamp and content through as_micg_interface.

Sanitized evidence: mailbox returned one edge; selected message list returned
two TEXT nodes without duplicate node IDs. No top-level GraphQL errors were
present in the inspected responses. No identifiers or message text retained here.

Independent reproduction: not performed. A private temporary Node replay runner
has passed its local parsing/header-filter self-check; it has made no request.

Verification result: browser observation only. Automatic approval review rejected
capturing unredacted authentication headers; owner-exported private headers and
approval to use them are pending before browser-closed replay.

Confidence: OBSERVED.

Subsequent preparation: the owner explicitly requested agent-managed session
preparation. A temporary probe retained headers/tokens solely in memory and
disconnected DevTools. A changed fb_dtsg value after reload was observed; the
prepared requests use fresh authentication fields. No credential file was
created. Replay is waiting for Chrome exit. A forced-termination proposal was
rejected by automatic approval review and removed from the probe.

Standalone attempt: after the owner quit Chrome, the exit guard passed and one
Node mailbox POST returned HTTP 200. Its response failed GraphQL data/error
validation; initial safe error diagnostics were insufficient to establish why.
No successful read, second request or retry occurred. Credentials were discarded.
A revised probe adds numeric error diagnostics and accepts empty error arrays;
fresh preparation is blocked on DevTools reconnection after Chrome reopened.

Known limitations: owner-selected-account scope is based on the owner's report;
account identity, pagination, ordering, expiry, and necessary token/header sets
remain unverified. Opening a conversation triggered a mark-read mutation. No
send operation or receipt has been observed. A successful status alone is not
protocol verification.

Next action: restore Chrome DevTools access after restart, prepare fresh requests
in memory, then quit Chrome before revised manual Node experiments separated
by at least five seconds. Keep session values out of the
transcript, repository and context-mode knowledge base. Obtain sender/recipient,
exact content and count authorization separately before E4.

## E1–E3 — Browser-closed Node reproduction (passed)

Discovery ID: E123-NODE-20261028

Hypothesis: the observed mailbox and selected-conversation queries can run in
Node without Chrome or a DevTools connection.

Test environment: project-pinned Node and Chrome DevTools MCP; owner-selected
controlled session. Authentication fields and response comparisons held only
in memory. DevTools disconnected before the owner quit Chrome.

Controlled action: take fresh same-origin browser read baselines; check Chrome
has no running main process; manually replay each query once, at least five
seconds apart, with redirects refused.

Observed transport: standalone Node HTTPS POST to the observed GraphQL endpoint.

Endpoint or operation: https://www.threads.com/api/graphql;
BarcelonaMessagesThreadListMailboxQuery and BarcelonaMessageListContainerQuery.

Request structure: original observed operation IDs and conversation parameters;
current shared form fields and observed headers, including browser fetch/client
metadata. No parameter or endpoint guessed; no automatic retry or polling loop.

Response structure: the same GraphQL data, edge, node and page_info paths as the
browser observations. Earlier reduced-header runs produced HTTP-200 error
envelopes; diagnostic runs observed error 1357054 with a null payload.

Sanitized evidence: final mailbox response contained two threads with IDs matching
the fresh browser baseline. Final selected-conversation response contained three
messages; ordered IDs, senders, timestamps and content matched exactly. Both
responses were HTTP 200 with data and no GraphQL errors. Chrome-closed and
DevTools-disconnected checks passed. No comparison values logged.

Independent reproduction: both final read requests executed in Node after
Chrome exited, and matched independently obtained browser baselines in memory.

Verification result: standalone inbox listing and selected-conversation reading
passed. The process exited after both reads, discarding session material.

Confidence: REPRODUCED.

Known limitations: the minimum header/token set, expiry, pagination, recovery and
incoming transport remain untested. Initial snapshots had fewer threads/messages;
fresh baselines avoided treating state changes as protocol mismatches. No send
or SDK has been implemented.

Next action at this checkpoint: prepare one unique test draft for owner review
and obtain exact one-send authorization. The resulting test is recorded below.

## E4 — One authorized UI send, receipt independently confirmed

Discovery ID: E4-UI-20261028

Hypothesis: the selected controlled test conversation can deliver one unique
message from Account A to Account B.

Test environment: owner-selected running Chrome; project-pinned Chrome DevTools
MCP with network-header redaction. Draft and response content held only in memory.

Controlled action: prepare an unsent unique test marker in the captured test
conversation; owner reviews exact draft and account identities. Owner explicitly
authorizes that draft once from A to B and confirms receiving-account access.
Validate unchanged draft and conversation, then click Send exactly once.

Observed transport: browser UI action. Wire transport not established.

Endpoint or operation: UI Send control; no send API operation identified.

Request structure: not captured. No send payload or client-ID semantics asserted.

Response structure: no protocol acknowledgement captured. The immediate
post-click inspection did not identify a matching GraphQL send operation.

Sanitized evidence: one Send click; no retry; owner reports exactly one copy of
the reviewed test marker received independently on Account B. No text or IDs
retained in tracked findings.

Independent reproduction: independent receiving-account confirmation was
provided by the owner. A standalone Node send was not attempted.

Verification result: controlled UI delivery confirmed. This does not establish
a browser-independent send operation or prove that no duplicate could ever occur.

Confidence: VERIFIED for this single UI delivery and receipt only.

Known limitations: send payload, acknowledgement, transport, idempotency,
standalone sending, expiry, incoming subscription and pagination remain unknown.

Next action: preserve this evidence and stop sending. Any further controlled
send requires new exact recipient/content/count authorization; no SDK send
implementation until the actual operation is observed and independently tested.

## Required record for each future finding

```text
Discovery ID:
Hypothesis:
Test environment:
Controlled action:
Observed transport:
Endpoint or operation:
Request structure:
Response structure:
Sanitized evidence:
Independent reproduction:
Verification result:
Confidence: HYPOTHESIS | OBSERVED | REPRODUCED | VERIFIED
Known limitations:
Next action:
```

Record a source hash plus narrow code location for static evidence. Static code
does not prove server acceptance or reachability. Fixture creation requires a
separate privacy review of keys, values, URLs and nested payloads before staging.
