# Threads DM website integration — engineering handoff

Updated 2026-10-29. Repository: `/Users/admin/persona/hustle/threads-private-api`.
Canonical resumable state. Detailed records: `docs/experiments.md`,
`docs/protocol-map.md`, `docs/research-log.md`, `docs/feasibility-report.md`, `README.md`.

## Current work — fresh manual connection receive test passed

**REPRODUCED one new incoming event after a fresh manual connection. All owned
receivers stopped.** E5-SDK-FRESH-RECONNECT-20261029 used session **2154** and
`/private/tmp/threads-dgw-sdk-validation.mjs` with a ten-minute action window.
It imported the built SDK, verified controlled scope/owner, captured fresh setup
and a baseline in memory, closed its owned observation tab and disconnected
DevTools. After SDK readiness, the owner separately reviewed/sent exactly one
NEW B→A message and reported sent. The old late-reported message was not resent.

`check-incoming` ran once: one new SDK callback equaled one new message in a
separate Node read, comparing ID/sender/time/text in memory. Sanitized metrics:
`sdkIncomingMatchedNodeRead:true`, `sdkCallbackCount:1`, `usingBuiltPackage:true`,
`newScopedMessages:1`, `devtoolsDisconnected:true`,
`browserObservationTabClosed:true`, `messagesSentByAgent:0`,
`credentialsSaved:false`. `stop` exited **0**, with no failure diagnostic; private
state discarded. No new SDK code or additional offline test run for this step.

This is a fresh manual connection following prior clean shutdown, not revival
of the expired process or its discarded callbacks. The earlier expired message
remains unverified for push. Its action and this separate new action/comparison
are consumed; no further message or agent reply is authorized. One callback in
this bounded run does not establish provider-wide exactly-once delivery. Chrome
stayed open. Current aggregate evidence: 15-minute idle continuity, one manual
gap-message recovery, fresh subscription, and a separate new incoming event after
fresh manual connection. Genuine expiry/automatic reconnect/restart recovery,
browser-closed push and long-running production reliability remain unverified.

**All owned receivers stopped.** E5-SDK-SOAK-RECOVERY-20261029 used session **4000**
and `/private/tmp/threads-dgw-sdk-soak.mjs` with built SDK code. Fresh controlled
session/scope was captured in memory, its owned observation tab closed, and
DevTools disconnected. The SDK stayed ready for **900 monotonic seconds**, with
zero new message callbacks, no failures/reconnects, then stopped cleanly.

After that stop, the owner reviewed/sent exactly one new B→A gap message.
`read-gap` ran once: a separate Node read recovered exactly one new message.
Fresh browser setup was captured and its new baseline contained the identical
gap message in memory. A new SDK instance accepted the fresh subscription with
baseline IDs seeded, DevTools disconnected and owned tab closed. Output:
`gapReadRecovered:true`, `newGapMessages:1`, `sdkStoppedDuringGap:true`,
`manualReconnectReady:true`, `gapMessageIncludedInBaseline:true`.

A separately requested post-reconnect message was not reported before the
five-minute window expired. The helper emitted `testExpired:true`, phase
`post-reconnect-ready`, then stopped/exited **0** and discarded private state.
`check-incoming` for this phase was never run. Local statuses before expiry had
zero callbacks; there is no completed final message/deduplication comparison.
The owner was told the receiver stopped and not to send the pending message now.
The owner subsequently reported “sent.” The actual send time relative to expiry
is unknown. The planned post-reconnect message action is therefore consumed, but
no SDK callback/read comparison is available because private state was discarded.
No repeat send, automatic retry or fresh provider read was performed. Do not ask
the owner to resend that message or claim the post-reconnect test passed.
Do not infer or re-create a delivery result if an action report arrives late.
No replacement/extra message is authorized. A new live attempt needs fresh
capture and a fresh exact reviewed action after readiness.

Confidence: **OBSERVED** idle connection continuity and clean stop; **REPRODUCED**
one manual gap-message recovery and fresh SDK subscription. Post-reconnect new
message delivery and no-duplicate comparison remain **unverified** for this run.
This is manual recovery with fresh setup, not automatic reconnect, genuine
service expiry, load testing or power-loss recovery. No agent DM, forced logout,
provider read polling, website integration, commit or deployment. Only docs
changed; last offline checks remain 66 tests/typecheck/build passing. Previous
implementation commit: `ba83fbe`.

**REPRODUCED one incoming message through the compiled SDK. No live receiver is
running from that completed earlier test.** E5-SDK-PUSH-20261029: tool session **64341** used
`/private/tmp/threads-dgw-sdk-validation.mjs`, importing `dist/index.js`. It
verified the controlled owner, captured fresh setup/session in memory, took a
scoped baseline, closed its owned observation tab and disconnected DevTools.
`ThreadsDmIncoming.start()` resolved. The owner then reviewed/sent one new unique
B→A text and reported sent. One SDK callback was observed; an explicit separate
Node message read matched the single new message's ID/sender/time/text in memory.

Sanitized result: `sdkIncomingMatchedNodeRead:true`, `sdkCallbackCount:1`,
`usingBuiltPackage:true`, `newScopedMessages:1`, `devtoolsDisconnected:true`,
`browserObservationTabClosed:true`, `messagesSentByAgent:0`,
`credentialsSaved:false`. Chrome stayed open. `stop` exited **0**, with no generic
rejection diagnostic. Private state was discarded. The message action and one-shot
comparison are consumed; no further live message or agent reply is authorized.
The owner supplied the message text afterward, when private state was already
discarded; no new comparison/read was made and no text is retained in project docs.

`ThreadsDmIncoming` is now exported from `src/index.ts`. Source:
`src/threads-dm-incoming.ts` (session/lifecycle/callback handling),
`src/threads-incoming-protocol.ts` (bounded frames, envelope/base64/protobuf and
scoped message decoding). Reuses the existing `parseMessageList` and `DmMessage`.
Caller supplies exact captured URL/cookie/user agent/initial subscription packets;
no login, captured-state builder, DM send or automatic reconnect is included.
Scope is a single server-configured conversation. Setup must match stream ID,
initial acknowledgement and request ID before readiness. Session/packet values
are copied privately and released on close. Default uses the same Node 24 native
WebSocket headers overload as the reproduced prototype; a typed factory supports
offline testing. Native API typings omit that overload, so a narrow constructor
cast is documented in source.

Clean stop is explicit and idempotent, including before readiness and inside a
callback. Unexpected close/error, resnapshot/auth rejection, malformed/unsupported
data or callback failure stop without retry; errors are value-free. Startup/idle
deadlines clear timers and listeners. Only text events in the configured chat are
delivered. Local bounded message-ID/hash deduplication suppresses repeats and
rejects conflicting representations. No claim of provider ordering, cross-restart
exactly-once delivery or automatic missed-message recovery. Async callbacks may
finish out of order; any rejection stops the connection. See `docs/incoming-sdk.md`
for API usage, supported capture branch and explicit resource limits.

Validation: **66 synthetic tests**, `pnpm typecheck`, `pnpm test`, `pnpm build`
pass. New tests cover chunk boundaries, session-copy/replay, setup correlation,
wrong stream/ack/request, unsupported/oversize frames, base64/protobuf failure,
scope mismatch, duplicates/capacity, callback failures, early/late/inside-callback
stop, terminal-state restart refusal and startup/idle timer cleanup. No live
browser/provider request or new message during the offline extraction. CodeGraph
reported this repository unindexed; current source/callers were checked with `rg`.
The subsequent compiled-SDK live result is recorded above. The owner requested
a local commit of this checkpoint. No website change, push or deployment.

**Next:** review the documented results and plan website integration if the owner
explicitly requests that new task. No more message is needed to finish this
bounded test plan: the fresh-manual-connection receive check above passed. The
15-minute idle and manual recovery results do not establish production reliability.
Do not reuse terminated processes or consumed test messages.
Any new live message needs fresh exact sender/recipient/content/count approval.
Genuine expiry and recovery across restarts remain unverified. Website integration
needs a separate new task; no deployment is authorized.

The following paragraphs preserve the successful research checkpoint that supplied
the implementation evidence. Statements about SDK absence describe that earlier
checkpoint, not the extraction above.

2026-10-29: **REPRODUCED one standalone incoming Node push delivery.** After
Chrome frame verification, the research receiver replayed the exact captured
subscription setup with fresh session material in memory. The provider accepted
stream establishment and the protobuf subscribe operation. The owned observation
tab closed and its DevTools client disconnected before the incoming test. Chrome
stayed open. After the owner independently sent one reviewed unique B→A text in
the agreed chat, the Node receiver decoded one scoped new-message delta. An
explicit separate Node message read matched its ID/sender/time/text in memory.
Result: `standaloneIncomingMatchedNodeRead:true`, `newScopedMessages:1`,
`devtoolsDisconnected:true`, `browserObservationTabClosed:true`,
`messagesSentByAgent:0`, `credentialsSaved:false`. No message values retained.

The owner-performed one-message action and one-shot comparison are consumed.
No further send or live message is authorized. Tool session **57511** received
`stop`, exited **0**, and discarded its private state. Its shutdown also emitted
a generic `receiverStopped/transport_or_protocol_rejected` diagnostic after the
successful comparison; classify intentional-close handling before promoting the
research harness. Do not reinterpret that diagnostic as a failed delivery or
repeat the consumed test. No active receiver or captured session can be resumed.

Chrome frame classification was **OBSERVED** for version 5: types 15 establish,
13 data, 12 ack, 9 ping and 10 pong. The classifier completed without unsupported
types, incomplete frames or overflow during the bounded observation. The actual
handshake used auth type `6:0`, no embedded-establish query field, and an initial
type-2 envelope carrying the captured device/database/sequence configuration.
Full values stayed in memory. No frame body, credentials or private URL saved.

Repository code remains the research-only metadata classifier
`scripts/verification/dgw-frame-metadata.ts` plus synthetic tests. It emits no
payload or IDs, holds at most eight header bytes and skips payloads. Last checks:
typecheck, **56 tests**, build pass. **Reusable SDK incoming receiver is not yet
implemented/exported**; the working Node receiver is an ephemeral research
prototype outside Git, not production support. Website integration stays retired.

External helpers (source contains no embedded session/message values; paths may
disappear on restart): `/private/tmp/threads-dgw-node-research.mjs` (working
receiver), `/private/tmp/threads-dgw-node-init.js` (browser init hook), and
`/private/tmp/threads-dgw-metadata-observation.mjs` (earlier metadata observer).
The Node helper reads an older private scope record; do not print/index its
contents or copy it into the repository. New session capture is required for
any future live run; owner handles login/challenges.

Connection notes: `list_pages` worked after owner re-enabled debugging. Separate
pinned autoConnect clients initially timed out waiting for consent, then worked
after the owner's “try again.” The standard MCP redacts network cookies; the
private Node capture used the pinned autoConnect MCP without header redaction,
kept all values inside its process, and printed sanitized booleans only. Do not
export headers, change global configuration or launch an isolated browser.
Computer Use was unavailable (`Sky ... native pipe startup failed`); do not
repeat that as a prerequisite for DevTools.

**On resume:** honor the stop until the owner requests continuation. Review the
research helper and E5-NODE-PUSH-20261029, then extract a reusable bounded receiver
with synthetic tests. Preserve caller-supplied session material, exact captured
configuration, conversation filtering, no uncertain-send retry, clean stop and
timer/resource cleanup. Validate malformed protobuf/framing, stream IDs,
deduplication and resnapshot/auth rejection before claiming reliability. No
automatic reconnect/resnapshot, long-running behavior or expiry has been tested.
Any further live message requires fresh exact approval. No commit/push performed
in this continuation; working-tree changes listed by `git status` are pending.

User requested a commit and continuation. Local commit **91393b4** contains the
adapter, milestone, session lifecycle and durable send status work (26 reviewed
files). Its checks passed: typecheck, 51 tests and build. Nothing was pushed.

The following checkpoint now reproduces older-message pagination. Public
client code identified a separate query; two one-message browser research reads
and matching Node reads accepted the cursor and matched the initial ten-message
baseline. The SDK initial/older-page methods also matched live browser results.
No message sent. Pagination controller 26804 stopped and discarded credentials.

Changes: `parseMessageList` accepts `fetch__SlideThread` or `get_slide_thread`,
refuses ambiguous roots and can check expected thread before returning content.
`sessionFromCapturedForms` accepts `messagePaginationBody`, binds it to the initial
capture's conversation, preserves the Relay node ID/page size and rewrites only
`after`. Message cursors without a separate capture and mailbox cursors without
an observed variable name fail before dispatch; they no longer silently replay
the initial page. Custom session callbacks still work. Checks: typecheck,
**54 tests**, build pass. Evidence/setup: `docs/message-pagination.md`.

Incoming static work is documented in `docs/incoming-research.md`: DGW/Lightspeed
stream candidate, `slide_gql`, JSON envelope with base64/protobuf payload, and
delta dispatch. The decoder is in a17.js; it was absent only from the earlier
six-file subset. Static schemas do not establish active wire framing/auth,
initial sequence/device state, deduplication or standalone push support.

**Incoming observation completed:** after the owner reported one B→A test
message, owned tool session **75591** reported exactly one new non-A message.
The Node read matched a fresh browser read in memory, and the message was already
visible in the UI before that research browser read. No scoped HTTP read
operations were observed before the research read. The metadata observer recorded
21 Lightspeed frames (19 one-byte frames, one 2281-byte and one 353-byte frame).
Frame bodies were not collected/decoded, so this is correlation, not proof that
a particular frame carried the message or a standalone push implementation.

No agent message was sent. The one-shot check is consumed; `stop` completed with
exit code 0, discarding in-memory private state. The controller's cleanup removes
its observer and closes only its owned tab if no draft exists. No live controller
remains. Chrome and the website were not restarted. Evidence:
`docs/incoming-research.md`, E5-INCOMING-20261028 in `docs/experiments.md`.
Next: resolve DGW wire framing/authentication and scoped delta decoding before
implementing standalone push; do not guess subscription state or send again.

After commit `c7edfe9` (pagination/incoming checkpoint, typecheck + 54 tests +
build passed), static continuation recovered the DGW URL constructor, big-ID
binary framing and initial-stream path. Findings/provenance:
`docs/dgw-wire-research.md`. The codec is compiled JavaScript behind an
Emscripten-style shim in this asset, not proven to require a separate WASM fetch.
No downloaded code was executed, provider request made or new browser opened.
Next bounded action: metadata-only frame classification; actual authentication,
initial subscription state and scoped decoding remain unresolved. Do not request
another message until the observer/decoder is ready. No SDK push code added.

## Implemented — session reconnect and durable send status recovery

Implemented offline after the owner approved the next roadmap step. No live
browser action, session invalidation or message send was performed; the website
prototype remains retired and its repository was not modified.

- `ThreadsDmReader.sessionStatus`: configured/ready/reconnect-required/disconnected.
  Rejected sessions stop subsequent reads locally. `replaceSession()` accepts
  owner-supplied material, `disconnect()` clears the managed session, stale
  in-flight results are discarded, and queued reads build from the current
  session at dispatch. Concurrent success cannot clear an auth rejection.
- `ThreadsSendOutcomeUnknownError.reconnectRequired` flags observed auth rejection
  without claiming no delivery. The send handler blocks new drafts and other
  unattempted sends afterward. Owner reconnection replaces the handler/captures;
  unknown attempts are never retried.
- `src/threads-send-journal.ts` exports optional
  `createFileThreadsSendJournal(directory)`: a private absolute directory outside
  Git, local exclusive create/rename/fsync, random draft IDs plus status words
  only. No credentials, account/message IDs, content or private URLs are stored.
  Claims are durable before provider dispatch. Empty/partial claims remain
  consumed. Reopened handlers recover acknowledgement/unknown status without
  recreating attempts. No default storage path or credential persistence exists.
- Host setup/reconnect order and limitations: `docs/session-recovery.md`.
  The journal's parent must exist, directory/file permissions are 0700/0600, and
  the filesystem must support the required atomic/durable operations. Active
  draft state remains single-process; this is not general multi-instance routing
  or automatic reconciliation of unknown messages.

Validation: `pnpm typecheck`, `pnpm test` (**51 synthetic tests**), `pnpm build`
all passed. Tests include two independent processes racing on a claim and
reopening after process exit, handler restart after a lost response/status write,
storage failure before dispatch, permission/symlink refusal and session races.
Genuine service expiry and machine power loss have NOT been exercised. No
additional live send is authorized. No website changes, commit, push or deployment.

Next meaningful validation is owner-approved session-expiry/reconnect testing
with the controlled accounts, followed by live pagination/incoming updates.
Never expire or log out a shared browser automatically, and never repeat an
uncertain message to test recovery. Use the existing remote-debugging Chrome.

## Completed milestone — owner test accepted; prototype retired

### Milestone accepted; website prototype cleaned up

The owner reported the local app worked, then explicitly requested cleanup of
the prototype in `tiemdosime-bot` and documentation of the milestone. The final
runtime status showed **one provider send attempt** during the owner's manual
test. This is owner acceptance of the end-to-end prototype, not a separately
collected new B receipt/copy-count trace. Earlier direct Node sending already
has validated acknowledgement and independent B receipt evidence.

Canonical record: `docs/milestones/2026-10-28-local-threads-dm.md`.
The website retains only `docs/threads-milestone.md` as the prototype record.
The test UI, API/proxy routes/config/tests, dependency/tarballs, packaging edits
and unread-provider exception have been removed. Existing backup/deployment
changes were preserved. The owned tool session 23922 stopped cleanly, discarding
its in-memory session; `http://127.0.0.1:49652/threads-test` is retired.
No local test runtime remains active. Chrome and the actual test messages were
left alone. No commit, push, production deployment or homelab transfer occurred.

The reusable read/send adapter and both website-handler contracts remain here;
38 synthetic adapter tests were passing before this documentation-only update.
After cleanup the website API/Admin typechecks and builds all passed.
No additional live send is authorized. Do not resurrect the temporary runtime
or stale candidate checkout. Future product integration needs a new task.

The following sections preserve implementation and experiment history. Statements
that website routes were running/connected describe the retired prototype;
the lifecycle record above is the current state.

**VERIFIED: one controlled direct Node text send.** After reviewing the exact
unsent Node preview and A/B identities, the owner authorized that draft once.
Session 18158 invoked `ThreadsTextSendAttempt.send()` directly: one HTTP request,
validated acknowledgement, no UI Send click and no retry. The owner independently
reported B receipt. The Node approval and preceding UI-observation approval are
both consumed; **no further send is authorized**. Chrome remained open; a
browser-closed send was not tested.

Source: `src/threads-dm-send.ts`, exported by `src/index.ts`.
The sender takes an observed send-form template, headers and the messaging
sender ID, fixes the captured conversation, replaces text and the offline ID,
and validates the response's thread/sender/offline ID/text/message ID/timestamp.
It blocks a second call, including concurrent calls. Any failure after a request
starts is an unknown outcome: check receipt, never retry or reconstruct that
message as a new attempt. The guard does not survive a process restart; server
deduplication and restart recovery remain unknown.

Evidence: `docs/experiments.md` and `docs/protocol-map.md`. A fresh approved UI
observation captured the actual request/acknowledgement before implementation.
**The messaging sender ID differs from form `av`.** An obsolete assertion in
`/private/tmp/threads-node-send-phase.mjs` incorrectly equated them and ended
session 95410. Another existing DevTools client recovered the evidence in memory;
no replacement UI send was needed.

The successful Node controller was
`/private/tmp/threads-node-send-research.mjs`. It refreshed shared session fields
from the browser's setup request, read only the agreed conversation with the
previously reproduced read query, and bound the messaging sender to the latest
confirmed UI marker. It rebuilt the observed send form/variables and presented a
distinct unsent Node draft for explicit approval. After the one send it cleared
only its own exact preview. Receipt was recorded through
`node-receipt-confirmed`; `stop` and EOF ended the owned controller. Runtime
session material stayed in memory; no credentials were exported or saved.
Old tool sessions 71930, 95410 and 18158 must not be reused.

### Local website prototype connected — latest continuation

The owner explicitly approved local edits in `../tiemdosime-bot` and requested a
simple prototype. `AGENTS.md` now records that scoped override. No commit, push,
deployment, runtime session export or additional live message was authorized.

Adapter `0.2.0` exports `createThreadsSendHandler` from
`src/threads-send-handler.ts`. Two owner-only same-origin POSTs prepare an
immutable draft and confirm its exact identities/text/count once.
Concurrent/repeated confirmations share one attempt/outcome. Unknown delivery
stays unknown with no resend. There are at most 32 in-memory draft records,
expiring after 10 minutes; old IDs after restart fail closed. This is not durable
reconciliation or multi-instance coordination. Contract: `docs/website-send-handler.md`.

Website changes:
- `apps/api/src/channels/threads/config.ts`: optional private send configuration,
  exactly one allowlisted test conversation, separate messaging sender ID.
- `apps/api/src/channels/threads/send-routes.ts`: long-lived handler,
  `/admin/threads/drafts` and `/admin/threads/send`, strict Origin/JSON/body checks,
  private logging and sanitized/unknown outcomes.
- `apps/api/src/server.ts`: registers the send routes alongside existing reads.
- `apps/admin/src/app/inbox/threads/api/[[...path]]/route.ts`: POST forwarding for
  drafts/send; no browser cookies or Authorization forwarded; lost confirmation
  response becomes unknown, never a retry.
- API manifest, lockfile and Docker ignore pin/allow
  `vendor/threads-private-api-0.2.0.tgz`, SHA-256
  `7e7575e8d4eccab525f1182cb9e6e14739f58cf9fa7e018c275dcbf88ef90933`.
- Synthetic config/send-route/proxy tests, `docs/threads-prototype.md` and updated
  read documentation. No new screen; the earlier UI deferral remains.

Runtime setup is still disabled: API needs private `THREADS_SEND_CONFIG_JSON`
and the existing `THREADS_ALLOWED_THREAD_IDS_JSON`; Admin needs only the nonsecret
`THREADS_WEBSITE_ORIGIN`. Shapes are documented in the website's
`docs/threads-prototype.md`. Session material must remain API-only and outside Git.
Reuse Tailscale with no extra password. No production settings were changed.

Verification passed:
- Adapter `pnpm typecheck`, `pnpm test` (**38 tests**), `pnpm build`.
- Website synthetic read/send config, Fastify read/send routes, and Next read/send
  proxy tests; API/Admin typechecks and builds.
- Actual Next POST handler → loopback HTTP → compiled Fastify bridge → pinned
  0.2.0 adapter → synthetic provider. Draft made zero provider calls; two
  confirmations made exactly one provider call. No Threads request or live DM.
  The temporary test server closed after the check.
- Both repositories' `git diff --check`. Next's generated `next-env.d.ts` drift
  was restored to its original state. Website backup/deployment changes were
  pre-existing and preserved.

Public synthetic check helper: `/private/tmp/threads-prototype-check.mts`; it may
vanish. No test process remains active. The old source send controllers must not
be reused. No credentials are embedded in the prototype tests or tarball.

**Next:** configure/test the local prototype with the owner's current in-memory
controlled session if requested; a real website send requires its own exact
A→B draft/count approval and independent B receipt. A product screen is still
deferred; the website's Stitch workflow applies before a substantial new screen.
Do not deploy or transfer sessions to homelab under this local-prototype approval.

The owner prioritizes sending over read-only rollout. Homelab transfer and
deployment stay paused; the read-only candidate
`e0eedf60d5d4813f75225db84687add07547c0d2` remains unpushed and untouched.
Production permission/terms review, expiry, live pagination, synchronization,
media and recovery remain unresolved. Always attach to the owner's existing
remote-debugging Chrome; keep it open and retain session values only in memory.

## Project purpose and scope

**Product goal:** let the owner connect their own Threads DM inbox to their
website, to display messages and eventually send replies in conversations they
are authorized to manage. This is an application-integration prototype, not a
security assessment of Threads or of other users' accounts.

**Why protocol observation is involved:** the messaging interface is undocumented,
so the project studies the behavior of the owner's own normal web client using
owner-controlled test accounts and a consented test conversation. Never describe
it as an official or supported Meta API.

**Operating limits:** only the owner's authorized session and the two
owner-controlled test accounts. Do not access third-party conversations, hunt for
weaknesses, defeat authentication or access controls, evade rate limits or
platform protections, harvest other users' data, or automate unsolicited
messages. Keep credentials and private messages out of logs, commits and durable
agent memory. Any new test send needs explicit, message-specific owner approval.

## Current state

**Reads — REPRODUCED and implemented.**
`BarcelonaMessagesThreadListMailboxQuery` and `BarcelonaMessageListContainerQuery`
(POST `https://www.threads.com/api/graphql`) ran in Node with Chrome fully closed
and DevTools disconnected; thread IDs and ordered message IDs, senders, timestamps
and content matched fresh in-memory browser baselines. No comparison values were
printed or committed.

Implemented in `src/threads-dm-read.ts`, exported from `src/index.ts`:

- `ThreadsDmReader.listThreads(cursor?)` / `listMessages(threadId, cursor?)`.
- `allThreads()` / `allMessages(threadId)` async generators follow `page_info`
  cursors with a `maxPages` cap (throws instead of looping on a stuck cursor).
- Validating parsers (`parseThreadList`, `parseMessageList`, `parseGraphqlEnvelope`)
  throw at the trust boundary rather than returning partial data.
  **Text mapping corrected in 0.1.1:** observed wire `content` is an object;
  `content.text_body` becomes the public `DmMessage.content` string. The earlier
  synthetic fixture incorrectly used a raw string and masked this bug. A live
  website-stack read caught it; the fixture and a regression test now match the
  observed shape. Non-text content remains unsupported and fails closed.
- `ThreadsAuthRequiredError` on HTTP 401/403 and on the documented HTTP-200
  rejection envelope (numeric top-level `error`; code 1357054 observed), carrying
  `.code`. GraphQL `errors[]` stays a generic failure. Messages never include the
  response body.
- `minIntervalMs` rate cap (default 5000, matching the read experiments) serializes
  requests through a promise gate so concurrent callers and the `all*` helpers
  cannot burst. Tests pass 0; README says raise it, never lower it.
- `sessionFromCapturedForms()` builds a session from request bodies the owner
  captured themselves, rewriting only `thread_fbid` and a caller-named cursor
  variable inside the form's JSON `variables`; all other captured fields pass
  through unchanged. It performs no capture itself.

**Cursor variable name is deliberately caller-supplied** — it was never observed.
Omitting `cursorVariable` makes the `all*` helpers single-page rather than guessing.

**Website read wiring — implemented and reproduced locally with live data.**
The owner explicitly authorized changes in `/Users/admin/persona/hustle/tiemdosime-bot`.
Its Fastify routes (`/admin/threads`, `/admin/threads/messages`) and private Next.js
proxy (`/inbox/threads/api`, `/inbox/threads/api/messages`) consume the pinned local
`vendor/threads-private-api-0.1.1.tgz` in the initial read-only validation (the
current local prototype pins 0.2.0, described above). The older artifact has SHA-256
`ed79b8f1e88214cf09ab9500fb84c0e571ccbe475ad97b5158ea3fb93d6b2ff5`.

The owner clarified only their devices can reach the website through Tailscale.
Reuse that network boundary: **no additional password prompt**. Compose keeps
Admin loopback-published and API unpublished; public Caddy defaults to 404 outside
its existing allowlist. Those source restrictions were checked; the live Tailscale
ACL was not queried. No network rules were changed.

The final controlled check used the actual compiled Next GET handler → Fastify
injection → authenticated Node fetch, with session material solely in memory.
It returned **one allowlisted thread and six messages**, matching fresh browser
baselines including message IDs, sender IDs, timestamps, text and page info. An
out-of-scope thread returned 404 without another provider read. Chrome stayed
open; **zero sends**. This verifies the local application stack with real data,
not a deployed website or its network path. No runtime session values were saved.
The normal website process still needs private runtime session configuration;
without it the routes return 503 `threads_not_configured` and make no provider call.
Website setup: its `docs/threads-read-only.md`. No Threads inbox UI was added.

**Follow-up running local HTTP check passed.** The owner asked to test locally
before homelab transfer and approved only item 2 (commit the candidate). The exact
17 files were committed as `e0eedf60d5d4813f75225db84687add07547c0d2`, without a
push or deployment. Existing remote-debugging Chrome → running local Next website
→ running local Fastify HTTP API → Threads matched one allowed conversation and
six messages against fresh browser baselines. Private no-store headers were
present; out-of-scope reads returned 404 and local POST attempts returned 405.
This adds actual loopback HTTP/browser verification to the earlier injection
check. Zero provider writes. No credentials were exported or saved.

**Sends — one controlled direct Node text delivery VERIFIED.**

- Earlier approved UI deliveries established the wire operation. A subsequent
  approved UI observation captured request/acknowledgement shapes; nested
  thread/offline ID/text and outer message ID/timestamp equalities matched.
- One separately approved direct Node request validated the full acknowledgement;
  the owner independently confirmed receipt on B. Chrome stayed open and no UI
  Send click was used. All approvals are consumed.
- `ThreadsTextSendAttempt` and `ThreadsSendOutcomeUnknownError` are exported from
  `src/index.ts`. Text only, same captured conversation, new 63-bit offline ID,
  one attempt per instance, no automatic retry or persisted credentials.
- Messaging sender identity comes from observed message data, **not form av**.
  The latter comparison failed in an obsolete helper; it is not a delivery failure.
- Website draft/send routes are now wired as a locally tested prototype above.
  Server deduplication, browser-closed
  sending, process-restart protection and production compatibility remain unverified.

**Compliance gate.** `docs/feasibility-report.md` now carries a
platform-compliance assessment: CONDITIONAL GO for read-only, owner-only,
on-demand, low-volume reading of the owner's own inbox; NO-GO for production
Node sending until review. Controlled local sending was separately authorized
and is now verified as described above. The owner stated they accept the unofficial-interface risk for
read-only own-account use, which satisfies the read condition by owner decision.
No official Threads DM API exists (overview 2026-07-02, changelog 2026-08-18).

**Still open:** a genuine session expiry was never exercised (1357054 was seen with
stale/reduced headers, so treat it as "rejected at the auth/validation layer", not
proof of expiry); pagination traversal untested against the live service; incoming
synchronization (Iris deltas remain HYPOTHESIS) and restart recovery; media and
non-TEXT message types; minimum header set.

## Authorization, privacy, and working preferences

Engineering acceptance criteria, not optional. If a step exceeds approved scope,
stop and ask for specific permission.

- Read `AGENTS.md` and `docs/experiments.md` before live research. Only the two
  owner-controlled accounts and the agreed test chat are in scope. The owner
  handles authentication and challenges. Never retry an uncertain send.
- **No send is currently authorized.** A generic "proceed" or "continue" is not
  recipient-specific send authorization. Obtain the exact sender, recipient,
  displayed draft and count, then require independent B receipt confirmation.
- **Always attach to the owner's running remote-debugging Chrome.** This is now
  explicit in `AGENTS.md`, `.codex/config.toml` and the MCP verification script.
  Use `--autoConnect`; plain HTTP `/json/version` discovery at the UI's advertised
  `127.0.0.1:9222` returned 404, while autoConnect succeeded. Do not launch another
  isolated browser or ask for another sign-in there. The native MCP connection
  must be reconnected to inherit changed flags; the live check used a fresh
  project-pinned stdio client. No global settings or other profiles were changed.
  Keep session headers in memory; do not ask for header exports again.
- The owner was frustrated by repeated Chrome-closure requests. Diagnose with Chrome
  open. The browser-closed read requirement already passed; do not repeat that cycle.
- Approval review previously rejected saving unredacted authentication headers
  (memory-only was the accepted path) and force-ending shared Chrome (unsaved-work
  risk; the owner quit it manually).
- Never log or commit cookies, CSRF/token values, account IDs, message contents,
  private URLs or raw traffic. Keep private captures out of any persistent
  knowledge index. Do not modify sibling repositories or create a remote.
- **Communication:** `AGENTS.md` now requires plain language with everyday
  analogies and brief replies when explaining status or trade-offs to the owner.

## Static analysis artifacts (public code only)

Public assets were fetched without cookies and read as inert text; nothing
downloaded was executed. No session material is needed to re-examine them.

- **Send mutation module:** `/private/tmp/threads-mutation-static-vgYQyJ/a17.js`,
  SHA-256 `e4816be35fe86fa905b5419ebe28ae985fa8027549eae8ee53ffd2bee7b6423f`
  (source URL recorded in `urls.txt` beside it). Contains
  `WmiSlideTextMessageMutation.threads.graphql`, `sendTextMessage`,
  `executeMessageSend`, `WmiNormalizedMutation`, `WmiOfflineThreadingId`.
  `offline_threading_id` = 63-bit (ms timestamp then 22 random bits).
- **Earlier message-bundle analysis:** `/private/tmp/threads-send-static-r6fGHk/`
  holds three public assets, sanitized manifest/hashes, an inert
  `useBarcelonaMessagesSendMedia` excerpt with provenance, and a ~15 MB REA
  evidence bundle (parent evidence
  `ev_a0ea897399d250cf99356e8b136695f151aa451b6208d9405ad09b2ea5935600`). Derive
  focused summaries; never dump it into context. REA coverage was partial
  (`statistics.modules = 0`; retention caps hit), so it does not establish a call graph.
- The dispatcher in `WmiSlideSendPublicApi` has two branches (`SlideWebDIPlatform`
  runtime vs `SlideAppPlatform`); which one the web client takes was never
  determined, and it no longer matters for the read deliverable.
- REA ran via the project-pinned CLI with a process-local `SDKROOT`; the native MCP
  server needed a reconnect to inherit the owner's fix. No global toolchain or
  settings were changed by any agent.

## Temporary artifacts (outside Git, may vanish)

Check existence before use; never treat filenames as durable credentials.

| Path | Purpose / caution |
| --- | --- |
| `/private/tmp/threads-controlled-*/` (4 dirs) | **Private captures** — snapshots and request bodies with sensitive values despite header redaction. Never dump or index. In `-iFG1DS`: capture 12 = agreed-chat snapshot, 25 = message read, 63 = mailbox read. Deletion was offered and not authorized. |
| `/private/tmp/threads-memory-read-replay.mjs` | The successful in-memory Node read probe. Not running; its runtime credentials were discarded. |
| `/private/tmp/threads-controlled-dm.mjs` | Past one-DM UI controller. **Do not issue `send-approved` without new exact authorization.** Its immediate-capture strategy missed the wire op. |
| `/private/tmp/threads-send-bundle-inventory.mjs`, `threads-extract-send-module.mjs` | Read-only public-asset collector and AST extractor; never invoke downloaded code. |
| `/private/tmp/threads-send-static-r6fGHk/`, `/private/tmp/threads-mutation-static-vgYQyJ/` | Public assets and derived evidence (see above). |

Reuse `scripts/verification/stdio-mcp.ts` for MCP orchestration and the project's
Node executable. Never print server stderr or full authenticated tool responses.
Keep one MCP client alive for an observer rather than reopening clients.

No analysis process is in flight; the two previously noted idle broker PIDs
(71400, 73828) no longer exist. No send is in flight.

## Next steps (only when explicitly resumed)

Prefer work that needs no live action. Nothing below authorizes a send.

1. **Live read validation** (needs owner go-ahead and an available session):
   exercise pagination against the real service and deliberately expire or
   invalidate a session to confirm `ThreadsAuthRequiredError` fires on a genuine
   expiry. This closes the last read-side unknowns.
2. **Website wiring — local and host code implemented; activation pending:**
   `src/threads-read-handler.ts` exports `createThreadsReadHandler` via
   `src/index.ts`. It requires a website-owner authorization callback and a
   server-configured allowlist of consented threads; one-page reads only, no
   caching, sanitized errors, no sends or retries. Seven synthetic tests cover
   the access and privacy boundaries. See `docs/website-read-handler.md`.
   The owner identified `/Users/admin/persona/hustle/tiemdosime-bot` as the target;
   its `apps/api/package.json` confirms Fastify. Path and boundary added to
   `AGENTS.md`. The owner subsequently approved host integration, and the private
   Fastify/Next route stack passed the live-data comparison described above.
   Reuse the owner's Tailscale restriction, without a new password. Production
   deployment, private runtime session provisioning and verification from the
   actual deployed private website remain pending. Session material stays
   server-side and never reaches the browser or the repo.
3. **Incoming synchronization:** unresearched. Iris deltas / `slide_gql` via
   `SlideUQPPDeltasQuery` are HYPOTHESIS only; do not claim push or "live".
4. **Node send:** single controlled text delivery verified; source exported.
   Local website send wiring is implemented and verified with a synthetic provider.
   Production still requires a positive terms review; every additional live
   message requires fresh exact approval. Never retry an uncertain outcome.
   Persisted attempt protection and server deduplication remain unverified.

## Working tree and validation

This session's work is committed as `7385457` ("feat: add read-only DM reader;
document observed send operation"). No remote exists and nothing was pushed.
`.codex/config.toml` and `docs/tooling.md` edits were the owner's own (REA SDKROOT
scoping) and were preserved in that commit. `.claude/skills/*` symlinks were
created by the harness and left untracked on purpose. No sibling repository or
global shell/Nix/Codex setting was modified.

Checks at that commit, all passing: `pnpm typecheck`, `pnpm test` (18 tests),
`pnpm build`. See the continuation below for newer checks. Unit tests use synthetic fixtures and a stubbed `fetch` — they never
contact Threads. Do not rerun live experiments merely to validate a checkpoint.

Local checkpoint skill: `.agents/skills/save-progress/SKILL.md` (`$save-progress`),
also linked at `.claude/skills/save-progress`.

Continuation checkpoint (2026-10-28): changes in both repositories remain
uncommitted. This repository adds the read handler, observed text-object parser
fix/regression, compiled package metadata, remote-Chrome configuration/smoke
updates and docs. The website adds Fastify routes/config/tests, a private Next
proxy/test, the exact local package/lockfile, Docker build inputs and a new guide.
Its pre-existing owner changes in `docs/deployment.md`, `infra/deploy/control.ts`,
`infra/deploy/tiemdosime-backup.service` and `tests/deploy/backup.test.ts` were
preserved. Generated-only Next type import changes were reverted individually.

Latest checks: this repo's `pnpm typecheck`, `pnpm test` (**26 tests**) and
`pnpm build`; website API typecheck/build, Admin typecheck/production build,
synthetic route/config/proxy tests, existing HTTP log-privacy test; offline
production dependency bundle imports adapter 0.1.1. Source ingress checks passed.
The updated `pnpm verify:mcp chrome` also passed initialize/tool listing, attached
list_pages, its own public test tab, snapshot/network/evaluation checks and
close_page. The owner's existing tabs were not navigated or closed.
Live read result is recorded above. No commit, push, production deployment,
message send or credential file was created by this continuation.

Temporary non-secret test harnesses: `/private/tmp/threads-website-live.mjs`,
`/private/tmp/threads-website-live-verify.mjs`, `/private/tmp/threads-website-staging/`.
These do not contain captured values. The live harness held credentials and
baselines only in memory and its connection was closed after verification.

## Backend rollout preparation — 2026-10-28

The owner authorized proceeding with backend setup/rollout and then explicitly
chose **backend first, inbox screen later**. No UI/Stitch work is in progress.
The website's local `.agents/skills/deploy-production/SKILL.md` was read and is
the rollout procedure: checked main-branch CI, immutable images, existing operator
SSH alias; no direct image deployment, force push or unrelated changes.

Reviewable candidate: `/private/tmp/tiemdosime-threads-candidate-f7ttDm`, branch
`change/threads-read-only-f7ttdm`, created from fresh `origin/main` at
`4f123275d2fdb600e6b90eb7236bdd624746124d`. Main contains the original develope HEAD;
the candidate applies only this task's tracked diff and explicit new files,
preserving newer production changes and the owner's original worktree.

Additional candidate-only changes: optional raw-format env file
`/srv/tiemdosime/private/threads-read.env` for API alone (not worker/Admin), CI
Threads unit/proxy/Compose checks, packaged-image disabled-route checks and
public-ingress denial assertions. No database migrations, new public ports,
extra password or UI. The original website checkout does not yet include those
last rollout-only refinements; do not overwrite its unrelated owner edits.

Candidate checks: frozen offline install, Prisma generation with synthetic URL,
workspace typecheck and production build, synthetic Threads config/routes/proxy
tests and Docker Compose session isolation all passed. macOS deployment suite
cannot exercise Linux `/usr/bin/flock` and real `/tmp` semantics; its stuck owned
test was stopped. The compiled full deployment suite then passed in an isolated
local Colima Linux container (**35 passed, zero failed**). The disposable runtime
used the project's pinned public Node image, no network or production mounts.
CI will still build/check the actual ARM64 images before any production rollout.

Production preflight through `ssh homelab`: release 42, matching current and
successful revision above, supervisor active, six healthy containers (including
one Worker and private sidecar). Existing Compose version is 5.6.0. Personal
GitHub authentication is available per-command without changing the active work
account. Latest main workflow at preflight succeeded; no rollout was active.
No production settings or services were changed.

**Transfer authorization still pending:** automatic approval review rejected a
probe that would stream authenticated Threads cookies/headers from the owner's
Chrome to their homelab because destination-specific export authorization was
not explicit. No transfer/provisioning occurred. Do not retry or work around that
rejection until the owner explicitly approves this transfer and API-only root-
readable (0600) storage. The owner asked for local-first testing; do not infer
transfer consent from that question. They approved item 2, committing only the
candidate, and that was completed as `e0eedf60d5d4813f75225db84687add07547c0d2`.
Do not request permission again for that completed commit. Do not include the
owner's unrelated backup edits or push production while local-first review and
transfer authorization remain unresolved.

Concrete review: `docs/backend-rollout-review.md`. Public operational helpers
outside Git: `/private/tmp/threads-private-runtime.mjs` (SSH stdin probe/install,
no embedded session values), `/private/tmp/threads-server-reader-bundle.mjs`
(bundled exact 0.1.1 package), `/private/tmp/threads-linux-checks.mjs`,
`/private/tmp/threads-candidate-checks.mjs`,
`/private/tmp/threads-candidate-location.json`. The renderer self-check passed.
The live broker now supports `probe-server` and `provision-server`, but **neither
may run before transfer approval**; provisioning refuses an existing settings
file rather than replacing it. Refresh the Chrome session in memory, compare
server reads to fresh baselines, then install only after a successful read.

After transfer approval and the owner's resumption of homelab rollout: recheck
fresh main/active deployment, use the existing candidate commit and the skill's isolated production merge/push workflow,
wait for check/publish/deploy, verify exact revision/health and private Threads
reads without printing response bodies. Do not declare deployment complete from
an image publication alone. No send authorization exists.

## Active local HTTP test environment

Website `http://127.0.0.1:60616`, read-only inbox path `/inbox/threads/api`.
Both servers bind to loopback on unused ports; the owner's existing local
services and homelab are untouched. Session data stays in the local API's memory;
the Next child has no Threads session environment variables. A new owned tab in
the existing remote-debugging Chrome performed the HTTP check without another
login. The inbox screen remains explicitly deferred.

Owned PTY/tool session **24819** runs `/private/tmp/threads-website-live.mjs` and
the temporary API/Next processes. Send `stop-local-http` to close only these
servers and their owned local website tab, then `stop` to disconnect MCP. Do not
kill the owner's Chrome. `/private/tmp/threads-local-http.mjs` has lifecycle/test
code but no embedded session values. Once local review ends, discard the live
session by closing the owned test processes. If this tool session is gone,
inspect only the owned process path before cleanup; do not terminate unrelated
sessions or assume temporary servers survive a restart.
