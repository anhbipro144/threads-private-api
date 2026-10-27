# Protocol map

Evidence cut-off: 2026-10-27. **No authenticated Threads DM operation observed.**
The only current Threads network target verified here is the public site origin.
No HTTP/GraphQL/WebSocket DM transport is asserted.

| Capability | Endpoint/operation | Auth / fields / decoding | Confidence |
| --- | --- | --- | --- |
| Public landing | Browser navigation to https://www.threads.com/ | No owner session; login prompt visible | OBSERVED (E0) |
| Session verification | Unknown | Cookie names, CSRF, tokens and expiry unknown | HYPOTHESIS |
| List conversations | Unknown | IDs, cursors, shape unknown | HYPOTHESIS |
| Read messages | Unknown | Sender/IDs, timestamps, ordering unknown | HYPOTHESIS |
| Send message | Unknown | Payload, client ID, acknowledgement unknown | HYPOTHESIS |
| Incoming synchronization | Unknown | WebSocket/polling/SSE/other unresolved | HYPOTHESIS |
| Recovery | Unknown | Session renewal and sync checkpoint semantics unknown | HYPOTHESIS |

Historical public GraphQL and Instagram `direct_v2` strings in third-party code
are excluded from this DM map. The page title or presence of messaging UI labels
would not establish backend compatibility or authorize any private operation.

## Authentication research precautions

Keep network-header redaction enabled during initial observation. Identify names,
presence/absence, origins, method and operation names without returning token
values to the agent transcript. Redaction is not a guarantee that request bodies,
URLs, GraphQL variables, or response data are safe. Those can contain credentials
and private content too. Never print entire authenticated network responses.

If standalone reproduction requires session material, the owner must save it
privately outside Git with restrictive permissions. A future experiment must
validate the destination origin and refuse redirects that could leak credentials.
Never retrieve state from the production browser. Never automate login challenges.

## Evidence advancement

Use the complete record format in experiments.md. OBSERVED requires legitimate
client traffic; REPRODUCED requires execution outside the browser; VERIFIED
requires independent confirmation. For sends, successful HTTP status or server
acknowledgement alone cannot reach VERIFIED: the receiving test account must
confirm the uniquely identifiable message. No entries currently reach REPRODUCED.
