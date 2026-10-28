# Experiment register and rules

Updated 2026-10-28. Authenticated inbox and selected-conversation reads have been
reproduced in Node with Chrome closed and matched against fresh browser baselines.
The owner authorized one exact UI draft from controlled Account A to Account B,
and independently confirmed exactly one receipt on B.

## Rules

- Two owner-controlled test accounts only; inspect only their agreed test chat.
- Begin with read-only observation; owner handles sign-in and challenges.
- Use isolated temporary Chrome. Persistent authenticated state needs approval,
  an external research-only directory, and removal of `--isolated` if introduced.
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
