# Feasibility report

Assessment date: 2026-10-28. **Verdict: CONDITIONAL GO for a read-only, owner-only
display release (pending the owner's platform-terms confirmation); NO-GO for a
standalone Node send path and for a complete messaging SDK.** Browser-independent
inbox/message reads are demonstrated and now implemented as a read-only adapter.
Two authorized UI DMs were each confirmed received once, and the send wire
operation is now observed (a GraphQL mutation) and mapped statically — but not
reproduced in Node, which is gated on the platform-compliance assessment below.
Incoming synchronization, expiry and recovery remain unverified.

## Tool readiness

Independent Git repository, pnpm lockfile, strict native-ESM TypeScript foundation,
project-local Node 24.22.1 and project-scoped MCP configuration are in place.
Global Node 24.16.0, Codex settings, Nix configuration, and Shop-AI were not changed.
Four version-matched skills are installed locally with provenance and licenses.

Chrome DevTools MCP 1.12.0 initialized with 32 tools. The six required tools
list_pages, navigate_page, take_snapshot, list_network_requests,
get_network_request, and evaluate_script all passed over a real stdio MCP
connection against an isolated browser/public page. REA 6.8.0 initialized with
229 tools and inspect_analysis_settings passed. See tooling.md for runtime
versions, exact launch commands, diagnostic caveats and reproduction.

The active research session verified Chrome DevTools through the project-pinned
MCP client and a native REA settings call. REA's broader binary_session probe
initially failed during ownership preparation because the installed Swift
compiler and default SDK versions differ. The project now scopes SDKROOT to
the compatible installed SDK; a fresh project-pinned REA MCP server successfully
analyzed a public messaging bundle, with partial semantic coverage. The running
native REA connection needs a reconnect to inherit the fix. No global trust,
toolchain or Codex setting was edited. REA doctor also reports registration drift
and unavailable optional engines.

## Protocol findings

| Area | Evidence and result |
| --- | --- |
| Current reproduced endpoint | POST https://www.threads.com/api/graphql for two observed read operations |
| Authentication | Owner signed in; session reused in Node with Chrome closed and DevTools disconnected |
| Required auth headers/cookies/CSRF | Observed fields replayed in memory; minimum set, expiry and renewal untested |
| Conversations / pagination | Two thread IDs matched a fresh browser baseline; cursor fields observed, page traversal untested |
| Messages / identifiers / ordering | Three ordered message IDs, senders, timestamps and content matched a fresh browser baseline |
| Controlled sends / acknowledgements | Two exact A→B drafts authorized and clicked once each, each independently confirmed received once. Second send's wire op observed: GraphQL mutation `WmiSlideTextMessageMutation` POST to `/api/graphql` (not WebSocket). Variables/response mapped statically. Wire acknowledgement detail and Node send unverified |
| Incoming transport | Unknown; no WebSocket/polling/SSE claim |
| Expiry / errors / restart recovery | Token changed after reload; error envelope 1357054 observed during diagnosis; expiry/recovery untested |
| Static analysis | A bounded public messaging bundle was analyzed with REA; partial graph, send path unresolved |

Existing implementation research found public-content clients and historical
GraphQL/mobile notes, plus Instagram Direct implementations. None of the inspected
sources establishes working Threads DM support or Instagram compatibility. The
archived junhoyeo project explicitly warns that development stopped after Meta
communication. See research-log.md for sources, timestamps and confidence limits.

## Technical feasibility and limitations

Two authenticated read operations now work independently of the browser. A
temporary probe obtained fresh browser baselines, disconnected MCP, checked
Chrome had exited, and manually issued the two Node requests at least five
seconds apart. Both returned data without GraphQL errors and matched the
baselines. See experiments.md for the complete evidence record.

Maintainability is still unknown: minimum authentication/header requirements,
session lifetime, pagination, encryption, incoming transport and restart recovery
have not been established. The owner explicitly selected the running Chrome
session for this run. Session headers were transferred only in memory; private
traffic remains outside Git. No identifiers or message text enter tracked findings.

Sending and synchronization SDK methods would still encode unverified semantics.
Consequently
the repository contains a status export, tooling-verification code and a
deterministic verifier test; it has no DM client, fake endpoints, browser transport
fallback, DM fixtures, or automatically running live tests.

## Recommendation and next decision

E1–E3 read reproduction passed; expiry and pagination portions remain open.
One exact-draft UI send and independent receipt are now confirmed. Do not send
again under that exhausted one-message authorization. Further send-protocol
research needs a new exact approval; inspect the actual transport before a Node
send implementation. Then investigate incoming synchronization and
safe expiry/restart recovery. Reassess GO only on independent core-operation
evidence; use CONDITIONAL GO only if working operations have explicit material
limitations. Do not initiate mobile analysis merely to route around absent login.

Do not integrate Shop-AI now. If the gate passes, release a versioned standalone
package and implement an explicit provider adapter with isolated identities,
scoped message IDs and capability-aware inbox actions. The design in
shop-ai-integration.md is based on current read-only source inspection.

Private protocol changes and account restrictions remain deployment risks.
Review current platform terms and operational account rules before deployment.

## Read-only website display option (design only, not implemented)

The only capability with REPRODUCED evidence is reading the owner's inbox and one
conversation, so a display-only first release is the smallest defensible scope.

- **Shape:** a server-side Node module with two calls, `listThreads()` →
  `BarcelonaMessagesThreadListMailboxQuery` and `listMessages(threadId)` →
  `BarcelonaMessageListContainerQuery`. The website frontend talks only to the
  owner's own backend; session material never reaches the browser or the repo.
- **Session:** owner-supplied and held server-side (secret store or process
  memory). Minimum header set, lifetime and renewal are untested, so any auth
  failure (including error envelope 1357054) must surface as "owner re-auth
  required". Never automate login or challenges.
- **Freshness:** pull on demand with a small per-session rate cap. Incoming
  transport is unknown (Iris deltas are HYPOTHESIS), so no push or "live" claim.
- **Not covered:** pagination (cursors observed, never traversed), media,
  encrypted or non-TEXT message types, read receipts. The browser fires a separate
  mark-read mutation when a conversation is opened; the two read queries alone
  were not shown to do so, which is unverified.
- **Gate before building:** exercise pagination and a deliberate expired-session
  failure on the test accounts, then check platform terms. Replies stay out of
  scope until the send wire operation is observed under a new exact approval.

## Platform-compliance assessment

This is an engineering risk assessment for the owner's own use, not legal advice.
It is the explicit gate the sections above defer to; confirm current Meta/Threads
terms before any deployment or before reproducing sends outside the official client.

**No supported path exists.** The official Threads API (overview updated 2026-07-02,
changelog latest 2026-08-18) exposes no DM/messaging capability or permission. The
owner confirmed this gap is the project's reason to exist. There is therefore no
first-party API to prefer; the only route observed is the private web-client
GraphQL interface, which Meta does not document or support and may change or restrict
without notice. "HTTP 200 from the private endpoint" is not evidence of permission.

**Risk factors to review before relying on this (not resolved here):**

- **Terms of service.** Automated access to the private interface outside the
  official client may fall under Meta's platform-terms restrictions on unauthorized
  or automated access. Owner-only, own-account, on-demand use is the most defensible
  posture, but "most defensible" is not the same as "permitted" — verify the current
  terms for the owner's account type and region.
- **Automation and protections.** Never evade rate limits, challenges, or other
  protections. Reads should be on-demand with a small per-session cap (as designed),
  never background polling or bulk pulls. No login/challenge automation.
- **Third-party data.** Even the owner's own inbox contains other people's message
  content and identifiers. Beyond the two controlled, consented test accounts, any
  real conversation involves a counterparty whose data is displayed/stored — a data-
  protection obligation (lawful basis, retention, deletion) the owner must own before
  production, not just a technical detail.
- **Account enforcement.** Private-protocol changes or anti-automation enforcement
  could degrade, lock, or ban the account. Treat the integration as best-effort and
  expect breakage; surface auth failures as "owner re-auth required" and stop.

**Read vs. send risk.** Reads pull the owner's own data on demand and are the lower-
risk, already-reproduced capability. Sending is a write through the private interface
and a clearer automation signal; it carries more terms and enforcement risk, so it is
held behind this review and should not ship without positive confirmation that current
terms permit it (or an official channel appearing).

**Compliance verdict.** CONDITIONAL GO for a **read-only, owner-only, on-demand**
display of the owner's own inbox at low volume, contingent on the owner confirming
current platform terms permit it and accepting the account-enforcement risk.
**NO-GO for a standalone Node send path** until that terms review is positive; the
send mechanism is documented for that future decision but deliberately not built.

## Definition-of-done audit

- [x] Independent Git repository and clean TypeScript/pnpm foundation.
- [x] Both MCP servers configured locally and actually tested over MCP.
- [x] Four relevant skills installed; no unrelated global configuration changed.
- [x] Public browser observation and existing-implementation research documented.
- [x] Evidence rules, protocol map and experiment register created.
- [x] Shop-AI design written; original repository left unchanged.
- [x] Type-check, unit test and build pass; no secrets/raw traffic tracked.
- [x] Active-session Chrome DevTools and REA connections verified, with REA limitations recorded.
- [x] Authenticated mechanism investigated beyond the login screen.
- [x] Standalone conversations and messages reproduced with Chrome closed and matched to browser baselines.
- [x] Two authorized UI sends each independently confirmed received exactly once.
- [x] Send wire operation observed (GraphQL mutation; variables/response mapped statically).
- [ ] Send reproduced in Node (deferred pending platform-compliance review; see below).
- [ ] Incoming synchronization and session/restart recovery tested.
- [ ] Browser-independent SDK and its protocol/unit/opt-in live tests implemented.

Unchecked items remain blocked, not claimed complete. Mobile investigation is
deferred by its conditional gate. No remote was created and nothing was pushed.
