# Threads DM website integration — engineering handoff

Updated 2026-10-28. Repository: `/Users/admin/persona/hustle/threads-private-api`.

## Project purpose and scope

**Product goal:** allow the owner to connect their own Threads direct-message
inbox to their website, so the website can display messages and, eventually,
send replies in conversations the owner is authorized to manage. This is an
application-integration/interoperability prototype, not a security assessment
of Threads or other users' accounts.

**Why protocol observation is involved:** the project is evaluating whether
messages from the owner's existing Threads web session can be integrated into a
Node-based website backend. The observed interface is undocumented and must
not be described as an official or supported Threads messaging API. The work
focuses on understanding the behavior of the owner's normal web-client message
features, using owner-controlled test accounts and a consented test conversation.
Technical terms such as GraphQL, request observation, public JavaScript analysis
and transport identification below refer to that narrow interoperability work.

**Operating limits:** use only the owner's authorized session and the two
owner-controlled test accounts. Do not access third-party conversations, search
for security weaknesses, defeat authentication or access controls, evade rate
limits or platform protections, harvest other users' data, or automate unsolicited
messages. Respect platform terms and applicable privacy requirements; if a
supported integration is available, prefer it. Keep credentials and private
messages out of logs, commits, and durable agent memory. Any new test send
requires explicit, message-specific owner approval.

**Current deliverable:** a feasibility-tested, narrowly scoped messaging adapter
for the owner's website, contingent on technical reliability, authorization,
and platform-permission review. No production-ready send API has been established.

## Current request and stopping point

The send wire operation is now identified: two authorized UI sends were each
confirmed received once on B, and the second was observed on the wire as a GraphQL
mutation `WmiSlideTextMessageMutation` POSTed to `/api/graphql` (not WebSocket).
Static analysis of the public asset then mapped its variables and response field
(see `docs/protocol-map.md` "Send message" and Checkpoints 4–5 below). The open
engineering question is now a **Node** send, which has not been attempted.

**This handoff does not authorize any new live experiment or message send.** Both
prior send approvals are exhausted; a Node send needs fresh message-specific
approval (sender, recipient, exact text, count 1) and independent B confirmation.
Resume only on a new user request.

Immediate next step on resume: decide between (a) the read-only website display
adapter (`listThreads`/`listMessages`) built from the already-reproduced reads —
no new approval needed — and (b) a single approved Node send probe. Prefer (a)
unless the owner explicitly asks to pursue sending.

Local checkpoint skill: `.agents/skills/save-progress/SKILL.md` (`$save-progress`).

### Checkpoint 2 (2026-10-28, Claude Code session)

- **Done (static, HYPOTHESIS):** text send traced to
  `useBarcelonaMessagesSendText` → `WmiSlideSendPublicApi.wmiSlideSendTextMessage`
  → op `"textMessage"` with a client `offlineThreadingId` →
  `WmiSlideAppPlatform.send()` → lazily loaded `WmiSend`/`WmiSlideSendHandlers`
  on an MQTT/Lightspeed-style client. Details, asset hashes and method list:
  "Text-send static trace" in `docs/research-log.md`; rows updated in
  `docs/protocol-map.md`. Nothing observed on the wire.
- **Browser:** `--autoConnect` to the owner's running Chrome worked without new
  prompts. All MCP clients from this session are closed; no observer was installed,
  no draft prepared, **no send made or authorized** (the owner said "tell me when
  u need the message", but no exact draft/sender/recipient was ever approved).
- **Official API re-checked:** Threads API overview (updated 2026-07-02) and
  changelog (latest 2026-08-18) list no DM capability or messaging permission.
  The owner confirms this gap is the project's reason to exist.
- **Owner edits to preserve:** `AGENTS.md` was rewritten by the owner during
  this session (uncommitted). `.codex/config.toml` and `docs/tooling.md` edits are
  also the owner's.
- **Ephemeral helpers** (session scratchpad, likely gone):
  `.../scratchpad/find-send-definition.mjs` (bounded exact-`__d` scan of loaded
  public scripts) and `resolve-cr-alias.mjs` (identifier-only `cr:` alias lookup).
  Their outputs persist in `/private/tmp/threads-send-static-r6fGHk/def-*.js` and
  `definition-manifest*.json` (public code only).
- **Still open:** idle processes PIDs 71400 and 73828 (owned
  `threads-controlled-research.mjs`) were not stopped; temporary private captures
  in `/private/tmp/threads-controlled-iFG1DS/` were not cleaned up.
- **Safe next work offered:** read-only website display design using the
  reproduced inbox/message reads, a limits/platform-risk write-up in
  `docs/feasibility-report.md`, and housekeeping of the items above.

### Checkpoint 3 (2026-10-28, resume check)

- PIDs 71400 and 73828 no longer exist (verified with `ps`); nothing to stop.
- The display-only release scope is already written in `docs/feasibility-report.md`.
- `/private/tmp/threads-controlled-*` capture dirs (four) still exist, not deleted.
- Next real step needs the owner: a live send observation requires a fresh exact
  draft/sender/recipient/count approval. No live action was taken.

### Checkpoint 4 (2026-10-28, approved send observation)

- Owner approved one exact send A→B (unique test string, count 1); Send was clicked
  once via Chrome DevTools. The message appears in the sender's chat and the composer
  cleared. **Account B receipt: owner confirmed exactly one receipt (VERIFIED, UI delivery only).** This approval is
  **exhausted**; do not send again.
- Page-side metadata-only observer (WebSocket.send, fetch, XHR; no payloads) saw
  around the send: only 1-byte and 8-byte frames on `gateway.threads.com/ws/lightspeed`
  (first nibble 0, not MQTT PUBLISH), 1-byte pings on `/ws/streamcontroller`, and XHRs to
  `/api/graphql` and `/ajax/bz`. **No frame large enough to hold the text was seen**,
  and the observer logged no click timestamp.
- OBSERVED/HYPOTHESIS: the page-thread `WebSocket.send` hook does not show the text
  payload, so the send may run in a Worker/SharedWorker or via a socket created before
  the hook, or the text went in the `/api/graphql` XHR (operation name not captured for
  XHR). **Unresolved.** Next read-only step: check Chrome DevTools network list for
  WebSocket/worker targets and XHR operation names for the post-click window.

- Follow-up (no send): DevTools `list_network_requests` (xhr/fetch) shows 40 POSTs
  (`/graphql/query`, `/api/graphql`, `/ajax/bz`), all 200, with no operation names in
  the listing and no websocket type filter. Naming them needs `get_network_request`,
  which returns full bodies containing session tokens, so it was **not** used.
  A reliable answer likely needs a CDP-level WebSocket-frame view or an in-page hook
  installed before the socket/worker is created, plus a new send approval.

### Checkpoint 5 (2026-10-28, second approved send, early-hook observation)

- Owner approved a second exact send A→B (unique string, count 1); Send clicked once.
  The message shows in the sender's chat. **Account B receipt: owner confirmed exactly
  one receipt (VERIFIED).** This approval is **exhausted**; do not send again.
- Hook injected via `navigate_page initScript` before page scripts (metadata only; no
  Workers were created). Window from click marker (t=0 ≈ click):
  +46 ms 1-byte frame on `/ws/streamcontroller`; **+261 ms XHR POST
  `www.threads.com/api/graphql` with `fb_api_req_friendly_name=WmiSlideTextMessageMutation`**;
  +821 ms 8-byte frame on `/ws/lightspeed`; +1.2 s `/ajax/bz`.
- **OBSERVED (one sample):** the web client's text send is a GraphQL mutation,
  `WmiSlideTextMessageMutation`, over HTTP POST `/api/graphql`. The earlier capture
  missed it because its filter looked for names containing "send". The Lightspeed
  WebSocket carried only 8-byte frames (not text-sized), so it is not the send
  carrier; its role (ack/ping/sync) is **HYPOTHESIS**.
- Not yet known: variables shape (thread id field, offlineThreadingId format), response
  and ack shape, idempotency, required headers. The payload was deliberately not read:
  `get_network_request` returns session tokens. Next safe step is a hook that records
  only the **variable key names** (no values) for this operation, which needs another
  approved send, or static analysis of the mutation's public Relay module.

- Static follow-up (no send): the mutation module is in a public asset already loaded
  at page start (`/private/tmp/threads-mutation-static-vgYQyJ/a17.js`, SHA-256
  `e4816be35fe86fa9…`, fetched without cookies). It gives the doc id, variables and
  response field now in `docs/protocol-map.md` "Send message". The page's
  `sendTextMessage` → `WmiNormalizedMutation` → Relay `executeMutation` path has no
  client retry. Server-side idempotency is still unknown, so **never retry a Node
  send**: on an uncertain result, read the thread and look for `offline_threading_id`.
- Next gate: a Node send probe that reuses the reproduced read envelope with this
  doc id. It needs new exact approval (sender, recipient, text, count 1) plus B
  confirmation. No send code was written to `src/`.

### Checkpoint 6 (2026-10-28, read-only adapter built)

- Built the display-only adapter from the REPRODUCED reads: `src/threads-dm-read.ts`
  (`ThreadsDmReader.listThreads()` / `listMessages(threadId)` + pure parsers
  `parseThreadList`/`parseMessageList`/`parseGraphqlEnvelope`), exported from
  `src/index.ts`. `researchStatus` now `read-reproduced-send-unverified`.
- Caller owns the session: it passes captured request `body` + `headers` opaquely;
  the module never stores/logs/inspects them. Non-200 throws status-only (no body),
  never retries — supports the "owner re-auth required" surface for expired sessions.
- Tests: `tests/unit/threads-dm-read.test.ts`, synthetic fixtures only (no real IDs,
  headers or message contents), `fetch` stubbed — no network. `pnpm typecheck`,
  `pnpm test` (10 tests pass), `pnpm build` all green.
- Not included (unchanged scope): pagination traversal (cursors are parsed/exposed
  but no loop), deliberate expired-session test on live accounts, media/non-TEXT
  types, send. Those remain the feasibility-report gates before building further.

### Checkpoint 7 (2026-10-28, platform-compliance assessment)

- Added "Platform-compliance assessment" to `docs/feasibility-report.md` and updated
  its top verdict + DoD. Verdict: **CONDITIONAL GO** for a read-only, owner-only,
  on-demand, low-volume display of the owner's own inbox, contingent on the owner
  confirming current Meta/Threads terms permit it; **NO-GO for a standalone Node
  send path** until that terms review is positive. No official DM API exists.
- Key risk factors documented (not resolved — owner's to review): ToS on automated
  private-interface access, no rate/protection evasion, third-party data in real
  inboxes beyond the two test accounts, and account-enforcement/breakage risk.
- The send mechanism stays documented for a future decision; it was deliberately
  not implemented in Node. Owner directed tackling the compliance review before any
  Node send.

### Checkpoint 8 (2026-10-28, pagination + re-auth handling)

- Owner confirmed they accept the unofficial-interface risk for read-only own-account
  use (the compliance gate's CONDITIONAL GO condition is met by owner decision).
- `AGENTS.md`: added a "Communication" rule — plain language, everyday examples,
  brief replies.
- Adapter now paginates: `allThreads()`/`allMessages()` async generators follow
  `page_info` cursors with a `maxPages` cap (throws instead of looping on a stuck
  cursor). Session builders take an optional `cursor`; the module never guesses the
  cursor variable name.
- Adapter now distinguishes re-auth from other failures: new `ThreadsAuthRequiredError`
  thrown on HTTP 401/403 and on the documented HTTP-200 rejection envelope (numeric
  top-level `error`, code 1357054 observed), carrying `.code`. GraphQL `errors[]` stays
  a generic failure. Error messages never include the response body.
- **Caveat:** a genuinely expired session was never exercised. 1357054 was observed
  with stale/reduced headers, so it means "rejected at the auth/validation layer",
  not proof of expiry. A live expiry test remains open.
- `pnpm typecheck`, `pnpm test` (14 pass), `pnpm build` green.

### Checkpoint 9 (2026-10-28, adapter made usable)

- Added `sessionFromCapturedForms()`: turns the owner's captured read request bodies
  + headers into a `ThreadsDmReadSession`, rewriting only `thread_fbid` and a
  caller-named cursor variable inside the form's JSON `variables`; all other captured
  fields pass through byte-identical. It parses owner-supplied material only and
  performs no capture itself. Throws on a capture it cannot parse.
- **Cursor variable name is caller-supplied on purpose**: it was never observed, so
  `cursorVariable` is optional and omitting it makes `all*` single-page rather than
  guessing a name.
- `README.md`: new "Read-only usage" section with a runnable example, the capture
  steps, the `ThreadsAuthRequiredError` re-auth path and the untested caveats.
- `pnpm typecheck`, `pnpm test` (17 pass), `pnpm build` green.
- Still open and live-only: genuine session-expiry test; incoming sync; Node send
  (compliance-gated, deliberately not built).

### Checkpoint 10 (2026-10-28, rate cap)

- `ThreadsDmReader` now enforces `minIntervalMs` (default 5000, matching the read
  experiments' interval): requests are serialized through a promise gate and spaced,
  so concurrent callers and the `all*` pagination helpers cannot burst. This makes the
  code match the compliance assessment's "on-demand, low volume, no bulk pulls" claim
  rather than leaving it as prose. Tests set `minIntervalMs: 0`; README says raise it,
  never lower it.
- `pnpm typecheck`, `pnpm test` (18 pass), `pnpm build` green.

## Verified progress and remaining uncertainties

- **REPRODUCED (owner's own inbox read):** `BarcelonaMessagesThreadListMailboxQuery` and
  `BarcelonaMessageListContainerQuery`, POST to
  `https://www.threads.com/api/graphql`, work in Node with Chrome fully closed
  and DevTools disconnected. Final results were two inbox threads and three
  messages in the selected controlled conversation. Thread IDs and ordered
  message IDs, senders, timestamps and content matched fresh browser baselines
  in memory. No comparison values were printed or committed.
- **VERIFIED delivery in the standard UI only:** the owner reviewed an exact unique draft,
  authorized one send from controlled Account A to controlled Account B, and
  independently confirmed exactly one receipt on B. The agent clicked Send once.
  This authorization is **exhausted**. No standalone Node send was attempted.
- **UNRESOLVED (text-message integration):** the immediate post-click observation
  did not identify the web client's send operation. It filtered only GraphQL requests with names containing “send” and
  inspected too early before exiting. Do not infer HTTP or WebSocket transport,
  payload, acknowledgement or idempotency from the successful UI delivery.
- No SDK or speculative protocol methods were added. Repository code remains
  the original research-status export and MCP verification harness.

Authoritative detailed records: `docs/experiments.md`, `docs/protocol-map.md`,
`docs/research-log.md`, `docs/feasibility-report.md`, and `README.md`.

## Authorization, privacy, and working preferences

The owner controls both ends of the test conversation. These requirements are
engineering acceptance criteria, not optional assumptions based on the product
goal above. If a proposed step exceeds the approved scope, stop and request
specific permission rather than proceeding.

- Read `AGENTS.md` and `docs/experiments.md` before live research. Only the two
  owner-controlled accounts and agreed test chat are in scope. Owner handles
  authentication and challenges. Never retry an uncertain send.
- The owner explicitly requested attachment to their running Chrome and later
  authorized agent-managed session preparation. The successful read probe kept
  session headers only in memory. Do not ask them to export header files again
  unless a new constraint actually requires it.
- Default project Chrome configuration remains isolated. The running-browser
  attachment was an explicit exception for this research session; do not edit
  global configuration or inspect other profiles.
- The owner was frustrated by repeated Chrome closure requests. Diagnose while
  Chrome stays open. Once reads work, obtain fresh baselines, disconnect MCP,
  close Chrome once, and run final independent verification. The read requirement
  already passed; do not repeat that cycle just for static/send observation.
- Automatic approval review rejected saving unredacted authentication headers.
  The approved safer approach used credentials in process memory only.
- Automatic approval review rejected force-ending shared Chrome because of
  unsaved-work risk. No force termination ran. The owner quit Chrome manually.
- No new send is currently authorized. Prepare observation and an unsent draft
  first, then obtain fresh approval for the exact sender, recipient, displayed
  draft and count. Require independent Account B receipt confirmation afterward.
- Never log or commit cookies, CSRF/token values, account IDs, message contents,
  private URLs or raw traffic. Do not put private captures in context-mode's
  persistent knowledge base. Do not modify sibling repositories or push/create
  a remote. No structured goal was created for this task.

## Read-only web-client interoperability findings

To identify how the ordinary web interface implements messaging, three
late-loaded **public** JavaScript assets were downloaded from the agreed
chat page into `/private/tmp/threads-send-static-r6fGHk/` (private directory).
They were inspected as inert text, never executed outside the existing browser.

The relevant asset is `bundle-3-d4b2f4e6d24a.js`:

- Public source: `https://static.cdninstagram.com/rsrc.php/v4iN1u4/yG/l/en_US-j/POxZApOftEi.js`
- SHA-256: `d4b2f4e6d24a95f4beac318ce96ae3dc572146d83e92988f6570e5b8d030447d`
- Size: 744266 characters.
- It contains the already observed message-list and mailbox query modules,
  including their `.threads.graphql` variants.
- `useBarcelonaMessagesSendMedia` depends on `WmiSlideSendPublicApi` and calls
  `wmiSlideSendMediaMessage` with media staging, reply and thread fields.
  This is **static code for the existing media-message feature**, not proof of
  how text messages are sent by the website.
- The `WmiSlideSendPublicApi` definition has not been located in the three assets.
  Avoid a broad bundle crawl; try exact loader/manifest mapping first.

REA successfully analyzed the selected asset through the **project-pinned CLI**
using an already-installed compatible SDK selected only for that process:

```sh
env REA_DARWIN_SWIFTC_PATH=/Library/Developer/CommandLineTools/usr/bin/swiftc \
  SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk \
  ./node_modules/node/bin/node ./node_modules/rea-agents/scripts/rea.mjs \
  analyze-javascript-application /private/tmp/threads-send-static-r6fGHk \
  --source-path bundle-3-d4b2f4e6d24a.js --detail summary \
  --evidence_output /private/tmp/threads-send-static-r6fGHk/rea-message-bundle-evidence.json \
  --analysis-timeout-ms 30000 --max-heap-mb 512 \
  --max-semantic-nodes 10000 --max-semantic-nodes-per-file 10000 \
  --max-semantic-unknowns 3000 --max-semantic-unknowns-per-file 3000 --format json
```

This command has already run. Its output path exists; REA refuses overwrites.
Reuse the evidence rather than rerunning it to obtain a smaller display.

- Parent Evidence: `ev_a0ea897399d250cf99356e8b136695f151aa451b6208d9405ad09b2ea5935600`.
- Full portable bundle: `rea-message-bundle-evidence.json` in that directory,
  approximately 15 MB. Derive focused summaries; do not dump it into context.
- It parsed one selected file without parse failures. Meta `__d` modules were
  not recovered as application modules (`statistics.modules = 0`), and semantic
  retention hit 10000 nodes / 3000 unknowns. Coverage is partial; do not claim
  a resolved sending call graph or runtime execution.

An AST-based extractor then isolated `useBarcelonaMessagesSendMedia` without
executing it. Artifacts:

- `module-excerpts/useBarcelonaMessagesSendMedia.mjs`
- `module-excerpts/provenance.json`
- Original factory source range: offsets 250019–251183 in the relevant asset.
- The excerpt wraps the original factory in an inert export for analysis only.
  Its provenance file records original/factory/wrapper hashes and dependencies.

The user subsequently said **“rea is fixed. Try it again if needed.”** A native
REA analysis of that tiny excerpt was attempted and still returned a startup
failure using xcrun against the incompatible macOS 27 SDK. The active server may
not have picked up the owner's new project configuration; do not assume their
fix failed globally. The CLI process-local workaround above already succeeded.
No global compiler/SDK/settings changes were made by this agent.

## Browser connection status and open questions

- The last read-only loader lookup timed out at Chrome DevTools `list_pages`.
  A question asked the owner to leave Chrome open, verify remote debugging and
  accept any connection prompt. That question was not explicitly answered; the
  later REA-fix message does not establish Chrome connection readiness.
- Proposed read-only lookup: inspect public property names on `window.require`
  and its possible `__debug` metadata, or exact module-to-resource mappings in
  public bootloader manifests. These shapes are **not yet observed**. Do not
  invoke arbitrary module factories or use REA browser tooling as another
  browser automation stack.
- A Node REPL attempt to host the MCP client failed before obtaining page data.
  It was closed; its private snapshot/URL references were cleared for handoff.
- No new draft was prepared, no observer hooks were installed, and no further
  send was attempted during this follow-up. No send is in flight. All owned
  analysis/collector requests have completed. Two old idle broker processes were
  still present at the last check: PIDs 71400 and 73828, both running the owned
  `/private/tmp/threads-controlled-research.mjs`. Their MCP clients were closed;
  do not reuse these old PTYs or mistake them for an in-flight send. Browser state itself
  has not been changed to close or kill Chrome for this checkpoint.

## Temporary tools and artifacts

These are outside Git and may disappear after reboot or temporary-file cleanup.
Check existence before use; do not treat filenames as durable session credentials.

| Path | Purpose / caution |
| --- | --- |
| `/private/tmp/threads-controlled-iFG1DS/` | **Private captures.** Contains snapshots and request bodies with sensitive values despite header redaction. Never dump or index it. Capture 12 is the agreed-chat snapshot; 25 is its message read; 63 is the mailbox read. |
| `/private/tmp/threads-memory-read-replay.mjs` | Successful in-memory Node research probe. Captures current session context, supports diagnostic and fresh browser baseline commands, then requires MCP disconnection and Chrome exit for final reads. It is not running; its runtime credentials were discarded. |
| `/private/tmp/threads-controlled-dm.mjs` | Past one-DM UI controller. **Do not issue `send-approved` again without new exact authorization.** Its immediate capture strategy missed the wire operation. |
| `/private/tmp/threads-send-bundle-inventory.mjs` | Read-only public-asset collector; at most three late-loaded assets. `--loader-info` requests only loader property names/manifest-presence metadata. Each run opens a new MCP client. |
| `/private/tmp/threads-extract-send-module.mjs` | TypeScript-AST extractor for the selected public factory; rejects string lookalikes and never invokes downloaded code. |
| `/private/tmp/threads-send-static-r6fGHk/` | Three public assets, sanitized manifest/hashes, REA evidence, and inert module excerpt/provenance. No session credentials are needed to analyze these artifacts. |
| `/private/tmp/threads-mcp-client-js/stdio-mcp.js` | Temporary compiled copy of the existing project harness for a Node REPL experiment. No repository source changes; experiment failed and is not the preferred continuation path. |

Reuse `scripts/verification/stdio-mcp.ts` for MCP orchestration and the project's
Node executable. Never print server stderr or full authenticated tool responses.
For a persistent observer, keep one client alive rather than repeatedly starting
clients and triggering new browser connection prompts.

## Next steps for the website integration (only when explicitly resumed)

1. Read current `AGENTS.md`, this handoff and current `.codex/config.toml`.
   Preserve the owner's configuration edits. Reconnect the appropriate project
   MCP servers if needed so the owner's REA fix is actually applied.
2. Reuse the existing static artifacts. Clarify the website's existing
   messaging implementation through a targeted, read-only search for
   `WmiSlideSendPublicApi` in loader/manifest metadata or another directly
   relevant public asset. Keep source URLs free of private queries and retain hashes.
3. If further observation is needed, first prepare a bounded, read-only
   diagnostic view of the owner's agreed test conversation. Observe the normal
   browser's relevant requests and completion signals without assuming they are
   GraphQL or HTTP rather than WebSocket. MCP may lack WebSocket-frame visibility;
   use supported browser diagnostics where appropriate. Keep private information
   in memory and limit observations to this consented test. No extra interception
   helper has been written yet.
4. Prepare a new unique unsent draft in the agreed A→B chat. Let the owner review
   the exact draft and account identities, then obtain a **new** one-send approval
   and B receipt availability. A generic “proceed” is not recipient-specific send
   authorization under the repository's explicit rule.
5. After explicit approval, observe the normal web client sending exactly one
   consented test message and confirm receipt on the other owner-controlled
   account. Keep any diagnostic request/response details private; never retry
   uncertain delivery. Design a Node message-send adapter only from verified
   behavior, and review its reliability and platform compliance before use.
   Any later Node-based test send needs separate message-specific approval.

Do not build the SDK from the media-helper name or UI delivery alone. Pagination,
expiry, incoming transport, restart recovery and a full messaging SDK remain open.

## Working tree and validation

Existing research documentation changes are uncommitted. At checkpoint time,
`git status --short` also showed `.codex/config.toml` and `docs/tooling.md` changed
externally during the owner's REA fix. This agent did not make those two edits;
preserve them. Do not reset or overwrite user changes. No remote/push/commit was
performed. No sibling repository or global shell/Nix/Codex setting was modified.

Last full checks passed: `pnpm typecheck`, `pnpm test` (one MCP harness unit test),
and `pnpm build`. Temporary read and draft-controller self-checks passed. In this
follow-up, public-module indexing and AST extraction self-checks passed, and the
selected-bundle REA CLI analysis completed with the coverage limits above.
The skill-creator Python validator could not run because PyYAML is absent;
validate the simple frontmatter with an available YAML parser instead of
installing dependencies merely for this checkpoint.
Only documentation and the local skill are added for this checkpoint; do not
rerun live experiments merely to validate the handoff.
