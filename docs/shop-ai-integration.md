# Shop-AI integration design — not implemented

Refreshed 2026-11-08 from a read-only look at Shop-AI's current source (first written
2026-10-27). Shop-AI was not edited or built. This is a proposal for Phase 7 of the
[readiness plan](integration-readiness-plan.md), not a migration or adapter. The SDK stays
unaware of Prisma, commerce and the admin UI.

## What changed in Shop-AI since the first version

- **Multi-shop.** A store has several `ShopAccount`s. `Customer` is unique on
  `(shopAccountId, instagramUserId)` and `Conversation` on
  `(shopAccountId, channelConversationId)`, no longer on `storeId`.
- **`ShopAccount.instagramAccountId` is required and unique.** A Threads connection
  cannot be added to a shop without either making it optional or keeping provider
  accounts in a separate table.
- **A private sidecar exists** (`apps/private-sidecar`, Instagram private operations). It
  runs as its own container with no published ports, keeps one session file per shop
  account in host-private storage (mode 0600), never logs in while running, suspends one
  shop at a time on a challenge, and never retries an uncertain mutation. A Threads
  connection should follow the same rules.
- **Messages carry `private*` columns** (`privateThreadId`, `privateItemId`,
  `privateSessionVersion`) for that sidecar. They belong to Instagram; do not reuse them
  for Threads.
- **Production has no Redis.** `publishChatChange` is an in-process `EventEmitter` in the
  API, so only code running inside the API process can update the inbox live. The worker
  is a separate container and does not notify the inbox.
- **AI processing is paused in production** (`AGENT_PROCESSING_PAUSED`).

## Current coupling

| Location | Coupling | Implication |
| --- | --- | --- |
| `infra/prisma/schema.prisma`, `Channel` | `INSTAGRAM` only | Add `THREADS` in an additive migration |
| schema, `ShopAccount` | `instagramAccountId` required, unique | A Threads account per shop needs its own field or table |
| schema, `Customer` | `instagramUserId`/`instagramUsername`, unique per shop account | Threads users need provider-neutral identity, not these columns |
| schema, `Message` | `instagramMessageId` globally unique | Threads message IDs need their own column, unique per shop account |
| `packages/shared-types/src/index.ts` | `Channel = 'instagram'` | Widen the type; label the platform in the inbox |
| `apps/api/src/channels/instagram/*` | Webhook, normalize, persistence, send | Keep as is; add a sibling `channels/threads` |
| `apps/api/src/agent/graph/nodes/send-reply.ts` | Imports `sendInstagramText` directly | Route through a channel dispatcher before any Threads AI reply |
| `apps/api/src/conversations/routes.ts` | Instagram send, reaction and unsend actions | Gate each action by channel capability |
| `apps/api/src/channels/instagram/webhook.ts` | Persists, then calls `processCustomerMessage` | The Threads path calls the same entry point after persisting |

## Identity

Keep `Customer` as the commerce person. Add a provider identity linked to it, unique on
`(shopAccountId, provider, providerUserId)`, and a Threads account per `ShopAccount`.
Store the SDK's `ThreadMember.id` as `providerUserId`, with `username`, `name` and
`avatarUrl` as display data that can change. Never merge an Instagram and a Threads
customer automatically, even when usernames match; an operator links them, auditably.

Conversations use the SDK's thread ID as `channelConversationId` with `channel: THREADS`.
Messages store the SDK's `messageId` in a new Threads column, unique per shop account.
Existing Instagram rows and columns are untouched.

## Runtime shape

```
 owner's Chrome --capture--> session file (host-private, per shop account)
                                   |
                                   v
 +------------------ threads container (one per deployment) -----------------+
 |  per shop account: one ThreadsDmIncoming without threadId (every chat)    |
 |  + ThreadsDmReader for catch-up and Message requests polling              |
 +---------------------------------+-----------------------------------------+
                                   | internal HTTP, bearer token, no published port
                                   v
 api: persist (dedupe on message ID) -> publishChatChange -> processCustomerMessage
```

- **Why a separate container:** API deploys would otherwise drop the live connection,
  and only one receiver may run per account.
- **Why it posts to the API:** without Redis, only the API process can update the inbox.
  The container holds the connection and protocol state; the API owns all database
  writes. The private sidecar works the same way, with calls in the other direction.
- **Sends** go API -> container -> one SDK attempt. An unknown outcome is recorded as
  unknown, keeps the draft and is never retried (`ThreadsSendJournal` records it).

## What the SDK gives the adapter today

| Need | SDK | Evidence |
| --- | --- | --- |
| Live messages from every inbox chat | `ThreadsDmIncoming` without `threadId`; `threadFbid` on each message and change | E23 |
| New customers | Not on the live connection; poll `listThreads` on the Message requests folder | E14 |
| Customer name, username, avatar | `ThreadSummary.members` | E12, E21 |
| Unread state, mark read | `ThreadSummary.unread`, `markThreadRead({ threadId })` | E21, E22 |
| History and catch-up | `listMessages` / `allMessages` per chat | E1–E3 |
| Text, image, shared post; others as `unsupported` | `DmMessage` union | E11 |
| Reactions, edits, unsends, reads | `onChange` (`DmChange`) | E16 |
| Reply with text, quote, photo | `ThreadsTextSendAttempt` (`replyToMessageId`), `ThreadsImageSendAttempt` | E14, E17, E18 |

Image URLs expire; the adapter must copy images into Shop-AI's own media storage on
receipt. Whether those URLs work without the session's cookies is not yet checked.

## Not ready

- **Reconnect.** `ThreadsDmInbox` replaces a dropped receiver and reports `live`,
  `reconnecting` and `needs-owner`, but it is tested only with synthetic sockets, and
  whether stored setup packets work after a drop is open (E19). The inbox must show
  `needs-owner` as "disconnected" truthfully.
- **Session capture and storage.** The capture command is Phase 5 and needs D6
  (approval to move session data to the homelab).
- **Real customers.** D3 (retention and deletion) is open; start read-only with AI off.

## Rollout

1. Schema and channel dispatcher, with Instagram behaviour unchanged and tested.
2. Threads read-only for one shop: receive, persist, show in the inbox, AI off.
3. Staff-approved replies after D1.
4. Whatever D7 allows.

Tests to add in Shop-AI: the same provider ID on Instagram and Threads, duplicate
delivery, restart and catch-up, session expiry, an uncertain send, and inbox actions
hidden where Threads has no capability.
