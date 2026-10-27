# Experiment register and rules

Recorded 2026-10-27. Only public observation has run. No owner credentials, test
account IDs, or recipient-specific send authorization have been supplied.

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
| E1 Auth | Owner signs in; inspect required header/cookie names and CSRF/request-token flow. Reproduce a verified read in Node with Chrome closed. Observe expiry safely; do not invalidate production state. | Blocked: controlled session |
| E2 Conversations | Open test inbox; correlate one request; record method, operation, parameters, response shape, conversation identity and cursors. Compare standalone read with browser. | Blocked: E1 |
| E3 Messages | Open agreed test conversation; record message/sender IDs, timestamps, ordering, duplicates and pagination. Standalone compare of sanitized results. | Blocked: E2 |
| E4 Send | After explicit recipient-specific authorization, send one unique test message; capture payload/ack; verify on second account. Reconcile uncertain results manually. Duplicate behavior stays untested unless separately approved. | Blocked: authorization, E3, two accounts |
| E5 Incoming | Observe inbox; second account sends one authorized message. Correlate arrival with WS frames/HTTP/SSE/other; use native WS Messages panel if MCP lacks frames. Reproduce without browser; close resources explicitly. | Blocked: two accounts and observed transport |
| E6 Static | Use REA only on publicly delivered resources correlated to E2–E5. Retain resource URL without private queries, hash and source locations. Trace request construction and decoding. | Blocked: observed DM code paths |
| E7 Recovery | After standalone transport exists, persist a minimal checkpoint atomically; restart; verify no loss/duplicate emission. Simulate expired auth without leaking credentials. | Blocked: standalone implementation |

Do not implement guessed `check-session`, `list-conversations`, `get-messages`,
`send-test-message`, or `sync-messages` scripts before their operations are observed.

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
