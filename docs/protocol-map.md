# Protocol map

Evidence cut-off: 2026-10-28. Authenticated inbox and selected-conversation
GraphQL reads have been reproduced in Node with Chrome closed and DevTools
disconnected. Two authorized UI DMs were each independently confirmed received once. The
second send's wire operation was observed as a GraphQL mutation. A subsequent
approved send captured the actual request and acknowledgement, with independent
B receipt. One separately approved direct Node text send validated the full
acknowledgement and was independently confirmed received on B, with Chrome open.

| Capability | Endpoint/operation | Auth / fields / decoding | Confidence |
| --- | --- | --- | --- |
| Public landing | Browser navigation to https://www.threads.com/ | No owner session; login prompt visible | OBSERVED (E0) |
| Session verification | Signed-in browser UI and successful standalone reads | Cookie, x-csrftoken, x-fb-lsd and request-token fields present; necessity, expiry and renewal untested | REPRODUCED (E1 partial) |
| List conversations | POST https://www.threads.com/api/graphql; BarcelonaMessagesThreadListMailboxQuery | Variables include folder and device_id_for_iris_subscription; data.get_slide_mailbox_for_iris_subscription.threads_by_folder has edges and page_info | REPRODUCED (E2) |
| Read messages | Same endpoint; BarcelonaMessageListContainerQuery | Variables include thread_fbid and min_uq_seq_id; data.get_slide_thread.messages has edges, cursors and page_info; node.as_micg_interface includes message_id, thread_fbid, sender_fbid, timestamp_ms and content.text_body (text is wrapped in an object) | REPRODUCED (E3) |
| Older messages | Same endpoint; `BarcelonaMessageListPaginationQuery`, observed doc id `28774468508869920` | Separate Relay node `id` from `SlideThread.id`, `first`, `after`, `before`, `last`, `has_live_chats` and provider flags; response `data.fetch__SlideThread.messages`. Forward older pages use `after:end_cursor`; node ID must not be replaced by thread_fbid | REPRODUCED two one-message browser/Node pages and SDK older read, Chrome open; full-history automatic traversal/default-size UI scrolling not verified |
| Fetch selected thread | Same endpoint; WmiSlideAsyncFetchAndInsertThreadQuery | Thread metadata, members and message edges; necessity and side effects not independently established | OBSERVED |
| Send message | POST https://www.threads.com/api/graphql; `WmiSlideTextMessageMutation`, observed Relay doc id `28577421681940194` | Observed variables: `thread_fbid`, `text_body: {sensitive_string_value}`, `offline_threading_id`, `send_silently: false`; null `recipient_fbids`, `replied_to_message_id`, `forwarded_message_id`, `mentioned_users`, `logging_data`. Response `data.send_slide_text_message`: `message_id`, `timestamp_ms`, `content_type: TEXT`, nested `as_micg_interface`. Nested thread/offline ID/text echo the request; message ID/timestamp echo the outer response. **Messaging sender differs from form `av`.** Static offline ID format: 63-bit (ms timestamp ‖ 22 random bits). Server dedupe is unknown; never retry | REPRODUCED in Node; VERIFIED one separately approved direct Node delivery and independent B receipt, Chrome open; duplicate/restart safety unverified |
| Incoming synchronization | `WmiDGWLightspeedStream`, serviceId `lightspeed`, logical `/ls_resp`, subscription `slide_gql`, delta query `39593085003640601`; observed version-5 DGW frames | Exact captured handshake/subscription replayed in Node; stream data → JSON envelope → base64 LSResponse protobuf → delta JSON `data.slide_delta_processor`. `ThreadsDmIncoming` filters one conversation; no guessed device/sequence state or automatic reconnect | REPRODUCED one private-prototype incoming event and a separate compiled-SDK event, each matched to a Node read after DevTools disconnection/owned-tab closure. SDK callback count was one. Chrome stayed open; expiry, long-running recovery and general duplicate semantics unverified. See `docs/incoming-sdk.md` and `docs/incoming-research.md` |
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
confirm the uniquely identifiable message. The two read operations reach
REPRODUCED. One controlled UI delivery reaches VERIFIED through the owner's
independent confirmation from Account B; this does not verify a Node send method.

The observed mailbox response contained one thread; the selected message-list
response contained two TEXT message nodes without duplicate node IDs. Pagination
fields were present but pagination was not exercised. Sender identities, ordering
and the mapping between mailbox and selected-thread identifiers remain unverified.
Opening the selected conversation also triggered
`WmiSlideThreadMutationsMarkReadMutation`; a browser read can change read status.

Initial request-header capture stayed redacted. Automatic approval review rejected
launching a server that would save unredacted session headers. The replay plan
requires owner-exported private request headers, checks that Chrome is closed,
permits only the two observed list queries at the exact Threads origin, refuses
redirects, and issues one read per run without retry. It has not made a request.

The owner subsequently authorized the agent to handle preparation directly.
An alternative probe now holds credentials only in process memory, refreshes
observed authentication fields after checking the account, and has disconnected
DevTools. Replay is waiting for the owner to quit Chrome. A proposed forced
Chrome termination was rejected by automatic approval review and removed.
No session credential file was created by this preparation.

One Node mailbox POST subsequently ran with Chrome confirmed closed and returned
HTTP 200, but failed GraphQL data/error validation. Safe error details were not
retained by that initial probe; successful retrieval is not established and the
message-list read was not attempted. Revised diagnostics are ready, but reopening
Chrome requires restoring the DevTools connection before fresh preparation.

## Successful standalone read reproduction

Fresh browser baselines and Node results were compared in memory. With Chrome
confirmed absent by a process check and the MCP connection closed, each Node
request returned HTTP 200 with GraphQL data and no errors. The mailbox returned
two threads with matching IDs. The selected conversation returned three messages;
ordered message IDs, sender IDs, timestamps and content matched the browser.
No values from that comparison were printed or added to this repository.

Earlier reduced-header attempts returned an HTTP-200 error envelope; subsequent
diagnosis observed numeric error 1357054 and a null payload. Successful requests
preserved the observed sec-ch-*, sec-fetch-* and priority headers along with the
existing application/authentication headers, and refreshed shared form fields
from a current observed request. The minimum required header/token set has not
been isolated. Initial snapshots had fewer threads/messages; fresh baselines
resolved that state-change ambiguity before the final comparison.

The probe used the two original observed operation IDs and conversation
parameters, refused redirects, made one request per manual command at least
five seconds apart, and retained session headers only in memory. It exited after
the two final reads. No SDK, send method or automatic synchronization was added.

## Single controlled UI send

The owner reviewed a unique unsent draft in the previously selected test chat,
then explicitly authorized that exact draft once from controlled Account A to
controlled Account B and confirmed access to B. Before clicking Send, the probe
checked that both the draft and captured conversation URL were unchanged.
It clicked once and did not retry. The owner independently confirmed exactly
one receipt on Account B.

The immediate post-click capture did not identify a matching GraphQL send
operation. No wire payload or acknowledgement is asserted. Its transport,
idempotency and standalone reproduction remain unknown; another test send
would require a new explicit authorization. No draft text, identifiers or private
conversation URL is recorded here. Browser sending was through Chrome DevTools;
no protocol send method or SDK was implemented.
