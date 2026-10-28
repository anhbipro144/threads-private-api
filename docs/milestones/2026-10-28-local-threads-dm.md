# Milestone: owner-tested local Threads reading and sending

Date: 2026-10-28. Scope: two owner-controlled accounts, one consented conversation,
and an unofficial Threads web interface. No third-party account access or bulk
messaging. The owner requested a simple functional prototype before deployment.

## Outcome

The owner used the running local application and reported that it worked. This
is the first owner-accepted local website prototype covering conversation reads,
draft preparation, exact review and explicit one-send confirmation. The final
runtime status recorded **one provider send attempt** during the owner's test.
The agent did not click Send for that test. No additional message is authorized.

Path exercised: browser test form → private Next POST proxy → loopback Fastify
API → pinned adapter 0.2.0 → observed Threads GraphQL operation. The current
session was held only in the API process; it was not exported to a file, given
to the Next process or committed. Authentication was performed by the owner.

Evidence levels are deliberately distinct:

| Capability | Evidence |
| --- | --- |
| Inbox and message reading | REPRODUCED in Node with Chrome closed; IDs, ordering, senders, timestamps and text matched fresh browser baselines in memory |
| One standalone Node text send | VERIFIED in the earlier controlled experiment: separate exact approval, one request, validated acknowledgement and independent owner-reported receipt on B |
| Live local website reads and draft preparation | REPRODUCED through the running browser/Next/Fastify stack; nine messages read, actual unsent draft prepared, confirmation initially disabled |
| Owner's local app test | Owner reported success; runtime recorded one provider attempt. No separate copy-count or acknowledgement trace from that manual test was collected |
| Duplicate/uncertain-outcome behavior | Synthetic handler/proxy/browser tests: concurrent or repeated confirmations use one attempt; unknown outcome remains locked and requires receipt checking |

## Reusable implementation retained

This repository keeps `ThreadsDmReader`, `ThreadsTextSendAttempt`,
`ThreadsSendOutcomeUnknownError`, `createThreadsReadHandler` and
`createThreadsSendHandler`, exported through `src/index.ts`. The sender fixes the
captured conversation, creates a fresh 63-bit offline ID, refuses redirects,
validates the full acknowledgement echo and never retries an uncertain outcome.
Messaging sender IDs differ from the form's `av` actor ID.

The draft handler prepares an immutable message for review and accepts explicit
approval for that draft/count only. Its draft/outcome storage is memory-only,
bounded to 32 records and ten minutes, with old IDs refused after restart.
The read/send handler contracts remain in `docs/website-read-handler.md` and
`docs/website-send-handler.md`; protocol details are in `docs/protocol-map.md`
and experiment evidence in `docs/experiments.md`.

## Prototype retired at the owner's request

After accepting the result, the owner requested cleanup of `tiemdosime-bot`.
The owned loopback Next/Fastify servers were stopped, discarding runtime session
material. The former test URL is no longer active. Chrome and the actual test
messages were left alone; cleanup did not unsend anything.

Website-only prototype code was removed: test screen and local focus styles,
private proxy and API routes/config/tests, server registration, packaged adapter
dependency and archives, Docker packaging additions and temporary unread-provider
exception. Prototype setup documents were replaced with a short milestone note.
Unrelated backup/deployment changes were preserved. The reusable adapter and
sanitized synthetic tests stay in this repository. Nothing was committed, pushed
or deployed, and no homelab session transfer occurred.

After removal, both website API/Admin typechecks and builds passed. The adapter's
38 synthetic tests, typecheck and build had passed before this documentation-only
cleanup; no adapter code changed. Both repositories passed `git diff --check`.

## Limits and follow-up

This is a controlled interoperability milestone, not an official Meta API or a
production-readiness claim. Server deduplication, durable reconciliation across
restarts, multiple instances, session expiry/renewal, live pagination, incoming
synchronization and media remain unresolved. Browser-closed sending was not
tested; only reads have that result. Any future live message needs fresh exact
approval, and an uncertain result must never be retried.

Future work should start from the reusable adapter and this evidence, with a
separate decision about product integration and production platform compatibility.
Do not resurrect the retired local runtime or infer further send permission from
the owner's acceptance.
