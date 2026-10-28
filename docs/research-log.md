# Existing implementation research

## Controlled research resume — 2026-10-28

- OBSERVED: native Chrome DevTools responds, and process inspection also finds
  a global server using `--autoConnect`. The association between that process
  and the native tool connection was not established. Use the separately
  launched, explicitly isolated connection for controlled authentication.
- OBSERVED: a separate project-pinned Chrome DevTools MCP server initialized
  through the existing StdioMcp harness with `--isolated`, header redaction, and
  no `--autoConnect`. A fresh tab reached the public Threads login page after
  the initial tab detached. The temporary harness and captures remain outside
  the repository; the research browser is left open for owner authentication.
- OBSERVED: native REA `inspect_analysis_settings` succeeds. Its broader
  `binary_session` probe fails during ownership preparation because the Swift
  6.3.3 compiler cannot build against the Swift 6.4 SDK. Doctor also reports
  unavailable optional engines and registration/skill drift. Static DM analysis
  has not been attempted; no global configuration or toolchain was changed.
- Pending: owner authentication and confirmation that a second controlled
  account is available. E1–E3, browser-closed Node reproduction, and E4 remain
  unperformed. No DM was sent or authorized; recipient-specific authorization
  is still required before sending.

Owner subsequently reported signing in. The isolated connection's original
Threads tab had closed; reopening Threads led to Instagram, with a separate
Google sign-in tab also present. Authenticated Threads access is not yet
confirmed. No credential fields, account IDs, or message contents were inspected.

### Attachment to the owner's running Chrome

The owner subsequently requested attachment to the running Chrome instance and
identified its remote debugging screen. The project-pinned server connected
using `--autoConnect` with header redaction. Direct connection to port 9222
failed because `/json/version` returned HTTP 404. No global settings changed.

- OBSERVED: a new Threads tab in that session rendered the signed-in home page;
  the login/password controls were absent and a Messages link was present.
- OBSERVED: opening Messages rendered a screen containing a Continue control,
  without a confirmed conversation list. The owner was asked to select the
  conversation with the second controlled test account.
- OBSERVED: captured POST GraphQL traffic included
  `BarcelonaNotificationBadgeContextQueryDirectQuery`. This notification badge
  operation does not establish inbox or message retrieval. HTTP 200 alone is
  not a successful protocol reproduction.
- Pending: complete the Messages prompt, confirm Account B, correlate actual
  conversation/message reads, then reproduce them in Node with Chrome closed.
  No standalone read, SDK method, or send has been implemented or attempted.

All raw captures remain in a private temporary directory outside the repository.

### Inbox and selected-conversation reads observed

After the owner's confirmation, captured traffic included the mailbox and
message-list queries documented in protocol-map.md and experiments.md. The
responses contained thread/message edges, sender/timestamp fields and cursors.
Opening the conversation also caused a mark-read mutation. No send was issued.

Automatic approval review rejected launching a capture server without header
redaction because it would save authentication headers. The temporary harness
was restored to header redaction; the rejected launch did not run. A private
Node runner now accepts owner-exported headers, requires Chrome to be closed,
restricts the endpoint and operations, refuses redirects, compares sanitized
results, and performs one read without retry. Only its offline self-check ran.
Authenticated reproduction remains blocked pending owner-provided private
session material and authorization to use it.

### Owner-authorized preparation in memory

The owner then explicitly asked the agent to handle session preparation. A
temporary probe used Chrome DevTools to obtain authentication fields solely in
process memory, without writing them to files or printing values. The account
field matched the earlier captured reads; fb_dtsg changed after a reload, so
the prepared reads use fresh observed authentication fields while retaining
their original operations and conversation parameters. Header/token necessity
has not been established by reduction experiments.

The reloaded page emitted `BarcelonaMessagesSetup_MailboxQuery`; original
mailbox/message query payloads remain the replay targets. DevTools has been
disconnected and both reads are prepared in memory. No standalone fetch has
run. Chrome's Quit command left its main process running; the closed-browser
guard prevented replay. Automatic approval review rejected a revised probe
that could terminate shared Chrome processes because of unsaved-work risk.
That termination code was removed, and the owner was asked to quit Chrome.
The active probe only checks for Chrome exit; it cannot quit or kill browsers.

### First browser-closed Node attempt

After the owner confirmed Chrome closed, the process-exit guard passed and one
standalone POST for `BarcelonaMessagesThreadListMailboxQuery` returned HTTP 200.
The parsed response failed the data/error validation check. The initial probe
did not retain safe error diagnostics, so an actual server error versus an
overly strict empty-errors check cannot be distinguished retrospectively. No
successful read reproduction is claimed. No second request or retry ran.
The probe exited, discarding its in-memory credentials.

A revised probe accepts an empty GraphQL errors array, emits only numeric error
codes/presence flags, and refreshes shared observed form fields while preserving
operation and conversation parameters. Chrome was reopened for fresh preparation,
but DevTools list_pages timed out. Computer Use's native pipe also failed to
start. The owner was asked to check the per-instance remote-debugging checkbox.
No revised standalone request, send, or receipt verification has run.

### Browser-closed reads passed

Further diagnostics identified the HTTP-200 error envelope as error 1357054 with
a null payload. A current mailbox-setup query succeeded in Node, followed by
both original read operations, after preserving observed browser header metadata
alongside fresh shared form fields. Header necessity was not isolated.

The current inbox/message counts differed from the first snapshots, so fresh
same-origin browser baselines were obtained in memory. DevTools was then
disconnected and the owner quit Chrome. With the Chrome-exit guard passing,
the final Node mailbox query returned two matching thread IDs, and the final
message query returned three messages with matching ordered IDs, senders,
timestamps and content. Both returned data with no GraphQL errors. The two
manual reads were separated by at least five seconds; the probe exited cleanly.
This is REPRODUCED. No message contents, identifiers or credentials were printed.

The owner noted the repeated Chrome closure requests. Those cycles were caused
by closing Chrome before request diagnosis was complete; the final successful
comparison now completes the browser-closed read requirement. Sending remains
pending explicit authorization and independent receiving-account confirmation.

### One authorized UI DM independently confirmed

After read reproduction passed, the owner requested preparation of an unsent
draft. A unique marker was filled in the captured test conversation without
sending. The owner reviewed the exact draft and account identities, explicitly
authorized exactly one A→B send, and confirmed access to B for receipt checking.
The probe verified that the draft and private target URL were unchanged, clicked
Send once, and never retried. The owner subsequently confirmed exactly one
receipt on Account B. This single UI delivery is VERIFIED.

The immediate post-click capture did not identify the send GraphQL operation;
wire payload, acknowledgement and transport are unresolved. No standalone send
or SDK was implemented. Authorization is exhausted; further sends need a new
exact approval. The probe exited and disconnected DevTools, leaving Chrome open.

Validation: pnpm typecheck, pnpm test and pnpm build passed. Temporary probe
self-checks and git diff --check passed. Only sanitized documentation changed
in this repository; private captures and temporary probes remain outside it.

### REA SDK mismatch and bounded static analysis

After the owner requested the next step, three recent public JavaScript assets
were selected from the agreed test-conversation page. The messaging asset came
from https://static.cdninstagram.com/rsrc.php/v4iN1u4/yG/l/en_US-j/POxZApOftEi.js
and has SHA-256 `d4b2f4e6d24a95f4beac318ce96ae3dc572146d83e92988f6570e5b8d030447d`.
A bounded static name scan found the previously observed mailbox/message query
module names and `useBarcelonaMessagesSendMedia`; presence of the media module
does not establish the text-send path or runtime execution.

REA's first static analysis failed during process ownership preparation. The
installed Swift 6.3.3 compiler failed against the default SDK built with Swift
6.4; the installed macOS 26.5 SDK compiled successfully. A process-local SDKROOT
setting allowed both the project-pinned REA CLI and a fresh project-pinned MCP
server to analyze selected public sources successfully. The messaging-bundle
MCP analysis retained parent Evidence
`ev_799d5c4f6ec7591e2009ecfe7f62fa8df52ad3aa7711faa32984bf23aa6dd24d`.
Its semantic graph is partial because selected-source and retention limits were
reached; a bounded reference-page inspection did not establish a send path.
The portable public-source Evidence bundle is at
`/private/tmp/rea-static-evidence.Hsy0EOZN/evidence.json`; its JSON structure
and inclusion of the retained parent Evidence were checked.

As a source-level cross-check, TypeScript parsed that same inert public bundle
without syntax errors. The `BarcelonaMessagesComposer.react` module spans
UTF-16 offsets 251190–260784 and declares dependencies on
`useBarcelonaMessagesSendText` and `WmiSlideSendPublicApi`. The text-send hook's
definition was not found within the three downloaded assets. These are static
dependencies, not observed text-send requests or proof of runtime behavior.

A follow-up exact-name scan (2026-10-28) of the same three assets found only
these `WmiSlideSendPublicApi` members referenced: `wmiSlideCreate`,
`wmiSlideCreateGroupThread`, `wmiSlideMarkFolderSeen`, `wmiSlideMarkThreadRead`,
`wmiSlideMarkUserActiveInThread`, `wmiSlidePublishTypingIndicator`,
`wmiSlideSendEditMessage` and `wmiSlideSendMediaMessage`. No text-send member is
referenced directly; text goes through `useBarcelonaMessagesSendText`, called with
`entrypoint: "thread_view"` (composer) and `"creation_flow"` (new thread). Neither
module is defined here and no loader/resource map is present, so the text path
remains UNRESOLVED and needs the defining asset or a browser-side mapping.

### Text-send static trace (2026-10-28, owner-requested, read-only)

Attached to the owner's running Chrome with `--autoConnect` on the agreed test
page (no login form present). `window.require` exposes no `__debug`/`modulesMap`
and no inline JSON mentions `WmiSlideSendPublicApi`, so no exact loader map exists.
A bounded scan fetched the 29 public `rsrc.php` scripts loaded on that page from the
CDN (no credentials, no query strings) and kept only exact `__d("<name>",` hits:

| Module | Asset SHA-256 (prefix) | Note |
| --- | --- | --- |
| `useBarcelonaMessagesSendText` | `6de6481f92f7` | Calls `wmiSlideSendTextMessage({text, threadId, repliedToMessageId, mentionedUsers, forwardedMessageId, loggingData})` |
| `WmiSlideSendPublicApi` | `07e7f9e300f1` | Text send generates `offlineThreadingId`, then dispatches op `"textMessage"` |
| `WmiSlideAppPlatform` | `06b88eedd229` | `send()` lazily loads `WmiSend` + `WmiSlideSendHandlers` |

`WmiSlideMessagingPlatform` picks `cr:17543` (web DI) or `cr:17544` (app platform).
An in-page lookup returning only identifier tokens near those keys found
`WmiSlideAppPlatform`; the web-DI alias likely resolves to null (not proven).
`WmiSlideAppPlatform` is built on `MqttWebDeviceID`, Iris delta sync and
`WmiBarcelonaLsConfig` (subscription `slide_gql` via `SlideUQPPDeltasQuery`); the
same asset contains an `/ls_resp` string. This points to an MQTT/Lightspeed-style
WebSocket transport rather than GraphQL HTTP, which would explain the earlier
GraphQL-only capture missing the send. All of this is HYPOTHESIS from static code.

Follow-up re-read of the saved `def-*.js` (2026-10-28, static, HYPOTHESIS): the shared
dispatcher in `WmiSlideSendPublicApi` has exactly two branches. If
`SlideWebDIPlatform` is non-null it runs `slideSendOperation(op, args)` through
`slideRuntime()`; otherwise it calls `SlideAppPlatform.getInstance().send()` then
`.send(op, args)`. Which branch the web client takes is unknown, so the observed
absence of a text-sized frame on the page thread is not explained by the code alone.
`WmiSlideAppPlatform.send()` loads `WmiSend` + `WmiSlideSendHandlers` only on first
use; neither is in the saved assets, and no loader map exists to locate them.

`WmiSend` and `WmiSlideSendHandlers` are `requireDeferred` and are not in any
currently loaded script; they presumably load on first send. Assets are saved in
`/private/tmp/threads-send-static-r6fGHk/def-*.js` with `definition-manifest*.json`.
No module factory was invoked, no draft prepared, no send made.

The project-only REA MCP config now selects that compatible SDK. Codex resolves
the project entry with the intended SDKROOT; reconnect the active REA MCP server
before relying on the setting there. No global settings or system toolchain were
changed. No additional live send was made or authorized in this investigation.

Accessed 2026-10-27 UTC. This is source research, not authenticated protocol
evidence. README claims, static strings, stars, and HTTP 200 responses do not prove
working DM behavior. Sources were read as untrusted text; none of their login,
signing, challenge, or sending code was executed.

| Source | Observed scope | Currency | Assessment |
| --- | --- | --- | --- |
| [molkex/threads-private-api](https://github.com/molkex/threads-private-api) | Python/TS clients for public posts, replies, feed, search, social, user; generic get/post helpers | Not archived; last push 2026-10-19 | No explicit DM implementation identified in inspected tree/client/social code; medium confidence, not exhaustive proof of absence |
| [junhoyeo/threads-api](https://github.com/junhoyeo/threads-api) | Public profiles, timeline, posts, replies, publishing and historical login | Archived; last push 2023-09-08 | Discontinued; no current DM support established; high confidence about archive status |
| [m1guelpf/threads-re](https://github.com/m1guelpf/threads-re) | Early web Relay GraphQL and mobile authentication/public publishing notes | Not archived; last push 2023-07-09 | Historical research only; its statement that web is read-only is not a current product claim |
| [subzeroid/instagrapi](https://github.com/subzeroid/instagrapi) | Instagram private client, including real Instagram Direct code | Not archived; last push 2026-10-27 | Useful architecture reference; zero verification of Threads compatibility |
| [Official Threads docs](https://developers.facebook.com/docs/threads/) | Public publishing, profiles/media, replies, insights | Landing page says updated 2026-07-02 | Reviewed landing/index does not establish DM API support or permissions |

## Exact inspected references

- molkex tree/client: commit `921662aad651638505a4c37d69b7e67160a5650a`;
  `ts/src/client.ts`, `ts/src/modules/social.ts`, README and complete tree listing.
  `reply()` explicitly targets public thread posts; `getThread()` returns a
  `DiscussionTree`. These are not DM retrieval/send methods.
- junhoyeo: commit `88d9e508702115cce902e6f92882d3da984f8158`;
  `threads-api/src/threads-api.ts`, `threads-api/README.md`, `PRESERVED.md`, tree.
  Root README contains a relative path, so the actual package README was opened.
  Its warning says development stopped following communication from Meta and
  warns about platform terms. Do not treat its former login scheme as current.
- m1guelpf: README on main, retrieved this date. It describes old
  `threads.net/api/graphql`, persisted query IDs, and an application header.
  Those historical public-content values were not replayed or promoted to DM APIs.
- instagrapi: `instagrapi/mixins/direct.py` on master, retrieved this date;
  contains `direct_v2/inbox/` and `direct_pending_inbox` among Instagram Direct
  operations. The README and repository metadata were also reviewed. This moving
  reference was not pinned for reuse and is not a reproducible Threads discovery.
- [Official markdown index](https://developers.facebook.com/documentation/threads.md)
  fetched successfully. Its overview/reference links do not prove DM availability.

GitHub API repository metadata supplied archive flags and push timestamps.
Bounded issue searches for DM/messaging/direct in the three Threads research
repositories found no useful DM evidence. Search coverage is limited by terms,
indexing, and repository scope; no claim is made about every implementation online.

## Applicability and unanswered questions

1. **Actual Threads DMs:** none established by the inspected sources. Current
   authenticated browser traffic is required; implementing their public-reply
   methods would fail this mission.
2. **Instagram overlap:** historical Barcelona paths, Meta infrastructure, and
   Relay provide a reason to investigate shared components. A shared DM backend,
   compatible session cookies, Instagram Direct endpoints, and identical IDs are
   all HYPOTHESIS for Threads. Do not reuse Instagram credentials or endpoints.
3. **Applicable techniques:** correlate one controlled UI action to requests,
   narrow static analysis to observed bundles, separate transport/auth, validate
   decoded responses, retain explicit unknown send outcomes, and deduplicate by
   verified provider identity. These techniques do not depend on old endpoint IDs.
4. **Known constraints:** no authorized test session supplied; client exposure
   of messaging, permissions, region/account eligibility, token lifetime, request
   signing, synchronization, and encryption requirements are unknown. There is
   no evidence that anti-bot behavior or encryption blocks this project yet.
5. **Risk:** private API changes can break clients or restrict accounts. The
   archived SDK warning is concrete maintenance/platform-risk evidence. Review
   applicable terms and current account rules before any deployment.

Next: reopen the project, verify native tools, have the owner authenticate a test
account, and perform E1–E3. Do not run broad bundle crawling or install mobile
tooling while the immediate blocker is simply absence of an authorized session.
