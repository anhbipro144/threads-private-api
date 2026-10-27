# Future Shop-AI integration design — not implemented

Read-only source inspection: 2026-10-27. Shop-AI was not edited or built. CodeGraph
was consulted first because the repository is indexed. Consequential schema and
transport findings below were checked against current files with native search
and targeted source reads. This document is a proposal, not a migration or adapter.

## Current constraints confirmed in source

| Current location | Observed coupling | Integration implication |
| --- | --- | --- |
| infra/prisma/schema.prisma, Customer | instagramUserId/Username; unique(storeId, instagramUserId) | Separate provider identities from commerce customers |
| schema, Conversation | channel defaults INSTAGRAM; unique(storeId, channelConversationId) | IDs can collide across providers/accounts |
| schema, Message | instagramMessageId globally unique; Instagram reply/private fields | Do not place Threads IDs in Instagram columns |
| schema, Channel enum | INSTAGRAM only | Add Threads through an explicit additive migration |
| channels/instagram/webhook.ts, normalize.ts, persistence.ts | Instagram ingress and message persistence | Keep Instagram normalization; add provider-specific ingress |
| channels/instagram/send.ts | Graph Instagram send; failed/unknown send outcomes | Preserve outcome distinctions through a channel dispatcher |
| conversations/routes.ts | Direct Instagram send/profile/reaction/private-operation imports | Route by conversation channel; gate unsupported capabilities |
| agent/graph/nodes/send-reply.ts | Imports sendInstagramText directly | Replace at adapter boundary before enabling Threads AI sends |
| agent/run.ts | Entry input is internal conversationId/messageId | Reuse shared AI entry point after normalized persistence |
| conversations/events.ts | In-process EventEmitter and publishChatChange | Reuse existing inbox notifications for one API process |
| packages/shared-types/src/index.ts | Channel = 'instagram'; customer fields Instagram-specific | Add provider-aware types and display identity |
| admin components/inbox/ConversationWorkspace.tsx | Existing shared conversation UI | Keep internal IDs; add channel label/capability-aware actions |

The proposed SDK must be an independently versioned package. Consume an exact
released version through Shop-AI's own manifest/lockfile after this project's
feasibility gate passes. No submodule, subtree, shared node_modules, or cross-repo
source import. No production integration is recommended at the current evidence level.

## Identity and migration proposal

Keep Customer as the commerce person record. Add ChannelAccount for the store's
connected provider account and CustomerChannelIdentity linked to Customer, with
unique(storeId, provider, providerAccountId, providerUserId). Provider IDs stay
opaque strings. Scope conversations by store, provider account and provider
conversation ID; do not assume a DM conversation ID is a recipient ID.

Store generic provider message identity scoped by provider account, with a unique
constraint sufficient for deduplication across threads (or include conversation
scope if live evidence establishes IDs are only thread-local). Preserve existing
Instagram columns during the transition. Add a separate sync checkpoint record
per provider account/stream, based on verified cursor semantics. No real cursor
or message shape is specified here.

Use an additive migration: create identities/accounts and generic ID fields;
backfill Instagram rows using the existing store/account relationship; validate
duplicate keys and missing configured account IDs before adding constraints.
Backfill must not change existing Customer IDs, carts, orders, or holds. Dual-read
legacy Instagram fields during rollout, verify counts/links, and postpone deleting
legacy fields until a separate approved migration. Collision checks must run
before changing Conversation's current unique constraint.

Never merge customers automatically by equal numeric IDs, usernames, display
names, phone numbers, or apparent Instagram/Threads linkage. New Threads identity
creates a separate customer unless an operator explicitly links it after review.
Make the link auditable and reversible; preserve original message provenance.
Default to separate commerce state until that decision is made.

## Adapter boundary and message lifecycle

An API-side provider dispatcher selects the existing Instagram implementation or
a future Threads adapter by stored ChannelAccount/Conversation identity. The
Threads adapter owns the independently versioned SDK and maps verified results
into provider-neutral inbound events. The SDK knows nothing about Prisma, shop
commerce, prompts, or admin UI.

Persist a normalized inbound message and its provider deduplication key in one
transaction; advance the verified sync checkpoint only after durable persistence.
Then invoke the existing processCustomerMessage entry point and publishChatChange.
Preserve inboundRevision/readThroughRevision and existing handoff/cart workflows.
Maintain one bounded sync worker per account; use a lease if multiple API workers
can run. The current EventEmitter is process-local; multi-process inbox deployment
requires shared event delivery as a separate deployment change.

Outbound operations first create a durable pending attempt, then call the selected
provider once. A verified ack records acceptance; receiving-account confirmation
is a research requirement, not a runtime delivery claim. Timeout/disconnect or
unusable ack records unknown, retains the draft, and requires reconciliation.
Never automatically repeat an unknown send. Serialize sends conservatively and
stop on expired auth, returning an operator reauthentication requirement. Do not
automatically launch a browser or rotate accounts to recover.

Keep Instagram webhook verification, read receipts, reactions, story handling,
private unsend behavior, and send validation unchanged. Represent Threads text
send/read/sync as capabilities only once verified. Hide/disable unsupported image,
reaction, unsend and read-receipt actions; do not infer them from Instagram support.
Start Threads in read-only mode with AI replies disabled until operator acceptance.

## Inbox, commerce and rollout checks

Use internal conversation/customer/message IDs for the shared inbox and commerce
cards. Display the source platform and provider identity explicitly; avoid labeling
Threads users with Instagram fields. Existing shop reservations, payment flows,
shipments and agent tools should continue using internal customer IDs. Keep channel
credentials and private protocol state on the API/worker side, never in admin.

Future implementation must test: same provider ID on different platforms/accounts;
Instagram backfill counts; unchanged existing Instagram send/webhook behavior;
duplicate ingestion; checkpoint crash/restart; auth expiry; uncertain send handling;
operator identity linking; handoff/read state; and capability-limited inbox actions.
Run applicable Shop-AI checks only in that separately authorized integration task.
