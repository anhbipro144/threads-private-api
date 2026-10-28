# Older-message pagination — reproduced 2026-10-28

**REPRODUCED:** two controlled one-message pages in the browser and Node matched,
including message IDs, senders, timestamps, text and page information. An SDK
initial read and an SDK older-page call also matched these baselines. Chrome
stayed open. All credentials/comparisons stayed in memory. Zero messages sent.

## Observed distinction

| Read | Operation / response root | Conversation argument |
| --- | --- | --- |
| Initial messages | `BarcelonaMessageListContainerQuery` / `data.get_slide_thread.messages` | `thread_fbid`, `min_uq_seq_id` |
| Older page | `BarcelonaMessageListPaginationQuery` / `data.fetch__SlideThread.messages` | `id` from the observed `SlideThread.id` |

The persisted pagination operation observed in the test is `28774468508869920`.
Variables included `id`, `first`, `after`, `before`, `last`, `has_live_chats` and
the client-provided Relay flags. The controlled reads used `first: 1`, first with
`after: null`, then with the first page's returned `end_cursor`. Both pages had
one distinct message and matched the first two messages of a fresh ten-message
initial baseline. The browser accepted the cursor; Node reproduced both pages.

These browser requests were deliberately initiated research reads using the
public client's persisted query. They were not caused by scrolling the normal UI:
the initial query asks for 20 messages and the test chat had only ten. No extra
messages were generated just to fill that page. Real default-size UI traversal,
full-history multi-page traversal and mailbox pagination remain unverified.

## Source corroboration

Public asset: `/private/tmp/threads-send-static-r6fGHk/bundle-3-d4b2f4e6d24a.js`,
SHA-256 `d4b2f4e6d24a95f4beac318ce96ae3dc572146d83e92988f6570e5b8d030447d`.
Matching earlier REA parent evidence:
`ev_a0ea897399d250cf99356e8b136695f151aa451b6208d9405ad09b2ea5935600`.
The semantic graph was partial; inert module text independently corroborates:

- `BarcelonaMessageList.react` (string offset 217917) reverses returned edges.
  Its visual older/top action maps to Relay `loadNext(20)`.
- `BarcelonaMessageListPaginationQuery.threads.graphql` (345508) declares the
  separate pagination variables and `fetch__SlideThread` root.
- `BarcelonaMessageList_SlideThread.threads.graphql` (375116) declares forward
  pagination `first`/`after` and identifies the Relay node through `id`.

Static evidence alone did not establish cursor acceptance; the live comparisons
above supplied that evidence. The opposite `last`/`before` direction is still
static-only and is not implemented by the captured-form helper.

## Adapter use

Pass `messagePaginationBody` to `sessionFromCapturedForms()` when providing a
captured pagination request for the same conversation as `messageListBody`.
The helper chooses the initial form for `listMessages(threadId)` and the
pagination form for `listMessages(threadId, cursor)`; it rewrites only `after`
on the latter, preserves its Relay node ID/page size/operation, and sets the
matching friendly-name header. It never substitutes `thread_fbid` for the node ID.

Pagination is bound to the initial captured conversation. Another conversation
needs its own matched capture/session. Backward templates, missing/ambiguous
variables, wrong operations and mismatched capture scope fail before dispatch.
The parser accepts both observed roots, refuses ambiguous roots and rejects
messages from another conversation before returning content.

`cursorVariable` now applies only to owner-observed mailbox captures. The old
behavior of adding it to the initial message query was unverified and cannot
represent the separate observed pagination operation. Message cursors without a
pagination capture, and mailbox cursors without an observed variable name, throw
instead of silently repeating the initial page. Custom session-builder callbacks
remain available for caller-observed operations.

`allMessages()` follows returned forward cursors with its existing page cap;
synthetic tests cover operation/root switching and stopping. Live SDK checks
covered initial and explicitly selected older reads, not the automatic helper
over a long history. Requests retain the default five-second spacing and no retry.

Public harnesses outside Git: `/private/tmp/threads-pagination-research.mjs`,
`/private/tmp/threads-pagination-library-check.mjs`. They contain no embedded
session values. Their controller was stopped, discarding its private captures.
