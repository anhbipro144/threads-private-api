# Scope and acceptance criteria

Recorded 2026-10-27. Target: Meta Threads direct messages, not public replies or
Instagram Direct. This repository must stay independent of `../tiemdosime-bot`.
The eventual package must use verified HTTP/GraphQL/WebSocket operations without
an active browser. Browser automation is a research instrument only.

## Gates

| Gate | Required evidence | Current result |
| --- | --- | --- |
| M1 | Authenticated authorized Node request with Chrome closed | Not tested |
| M2 | Standalone test-account conversation retrieval | Not tested |
| M3 | Standalone message retrieval with consistent IDs | Not tested |
| M4 | Controlled send plus receiving-account confirmation | Not tested; authorization absent |
| M5 | Incoming detection without browser automation | Not tested |
| M6 | Restart-safe sync state and safe authentication expiry | Not tested |

Only create operation-specific research scripts after recording their browser
evidence. Implement the reusable SDK only after M2, M3, and M4 pass. Do not fill
`src/auth`, `transport`, `protocol`, `client`, or `types` with speculative code.

The proposed public methods remain `listConversations(cursor?)`,
`getMessages(conversationId, cursor?)`, `sendMessage(conversationId, text)`, and
`syncMessages(): AsyncIterable<IncomingMessage>`. They are design intent, not an
implemented API. Add runtime response validation, typed errors, explicit cleanup,
timeouts, verified pagination, deduplication, and session-expiry handling only
against real sanitized evidence. No automatic retry after an uncertain send.

## Verification requirements

Use Node's built-in test runner with strict TypeScript. Protocol tests must cover
actual serialization, malformed responses, expiry, timeouts, pagination, duplicates,
and unknown send outcomes. Live tests must be separately enabled, validate test
account/recipient allowlists, bound rates and duration, and never run during build
or default tests. No protocol fixtures or live tests exist yet because no DM
traffic has been observed. Current unit coverage checks the MCP verifier only.

Keep runtime dependencies minimal; research tooling is development-only. No
frontend, database, monorepo, browser fallback, or deployment is part of this work.
