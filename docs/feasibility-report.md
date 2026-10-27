# Feasibility report

Assessment date: 2026-10-27. **Verdict: NO-GO for SDK implementation or deployment
at the current evidence gate.** Overall protocol feasibility is **undetermined**,
not disproved. This is an authorization/session blocker, not evidence that
browser-independent Threads DMs are technically impossible.

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

Codex CLI lists both project entries when run from this repository. The current
parent-directory conversation has not hot-loaded these entries. Reopen Codex in
the new repository and verify native tools before claiming active-agent readiness.
No global trust setting was edited. REA doctor inspects user-level registration
and reports drift/absent optional engines; those diagnostics do not invalidate
the successfully tested project-local MCP server.

## Protocol findings

| Area | Evidence and result |
| --- | --- |
| Current verified endpoint | Only public https://www.threads.com/ navigation |
| Authentication | Login prompt observed; no controlled authenticated session available |
| Required auth headers/cookies/CSRF | Unknown |
| Conversations / pagination | No DM operation observed or independently reproduced |
| Messages / identifiers / ordering | Unverified |
| Controlled sends / acknowledgements | Unverified; no recipient-specific authorization supplied |
| Incoming transport | Unknown; no WebSocket/polling/SSE claim |
| Expiry / errors / restart recovery | Untested |
| Static analysis | REA readiness tested; DM bundle analysis awaits observed code paths |

Existing implementation research found public-content clients and historical
GraphQL/mobile notes, plus Instagram Direct implementations. None of the inspected
sources establishes working Threads DM support or Instagram compatibility. The
archived junhoyeo project explicitly warns that development stopped after Meta
communication. See research-log.md for sources, timestamps and confidence limits.

## Technical feasibility and limitations

No M1–M6 milestone has passed. No authenticated operation works independently of
a browser **as demonstrated by this project**. Maintainability cannot yet be
assessed: session lifetime, request construction, response schemas, encryption,
sync transport, pagination and rate limits remain unknown. No experimental
failure has yet established that security protections or encryption prevent a
standalone client. Do not infer a backend from shared branding or old code.

The missing prerequisites are two owner-controlled test accounts, owner sign-in
to isolated Chrome in the resumed project session, and explicit test-send
authorization when E4 is reached. No production account/profile was accessed.
No private capture, session, token or message was collected or committed.

Building SDK methods now would encode guessed protocol semantics. Consequently
the repository contains a status export, tooling-verification code and a
deterministic verifier test; it has no DM client, fake endpoints, browser transport
fallback, DM fixtures, or automatically running live tests.

## Recommendation and next decision

Resume E1–E3 after owner sign-in. Reproduce authenticated listing and reading in
Node with Chrome closed. After recipient-specific approval, reproduce one send
and confirm receipt independently. Then investigate incoming synchronization and
safe expiry/restart recovery. Reassess GO only on independent core-operation
evidence; use CONDITIONAL GO only if working operations have explicit material
limitations. Do not initiate mobile analysis merely to route around absent login.

Do not integrate Shop-AI now. If the gate passes, release a versioned standalone
package and implement an explicit provider adapter with isolated identities,
scoped message IDs and capability-aware inbox actions. The design in
shop-ai-integration.md is based on current read-only source inspection.

Private protocol changes and account restrictions remain deployment risks.
Review current platform terms and operational account rules before deployment.

## Definition-of-done audit

- [x] Independent Git repository and clean TypeScript/pnpm foundation.
- [x] Both MCP servers configured locally and actually tested over MCP.
- [x] Four relevant skills installed; no unrelated global configuration changed.
- [x] Public browser observation and existing-implementation research documented.
- [x] Evidence rules, protocol map and experiment register created.
- [x] Shop-AI design written; original repository left unchanged.
- [x] Type-check, unit test and build pass; no secrets/raw traffic tracked.
- [ ] Native tools verified in a reopened project Codex conversation.
- [ ] Authenticated mechanism investigated beyond the login screen.
- [ ] Standalone conversations and messages independently reproduced.
- [ ] Authorized controlled sending independently confirmed.
- [ ] Incoming synchronization and session/restart recovery tested.
- [ ] Browser-independent SDK and its protocol/unit/opt-in live tests implemented.

Unchecked items remain blocked, not claimed complete. Mobile investigation is
deferred by its conditional gate. No remote was created and nothing was pushed.
