# Integration readiness plan

Status: **proposal, 2026-11-07. Nothing here is implemented or authorized.** A saved
plan grants no permission: every live message and session transfer still needs the
owner's exact approval under `AGENTS.md`. Evidence words follow the repository's
HYPOTHESIS / OBSERVED / REPRODUCED / VERIFIED meanings.

## Goal

Turn this SDK from a controlled test of one chat into a library that Shop-AI
(`tiemdosime-bot`) can use as a real customer inbox channel. "Done" means a customer
can start a new chat, send a photo or text, and appear in the inbox with their name.
Staff can reply, and no message is lost or sent twice when a connection drops.

Public Threads features (posts, replies, webhooks, insights) are not part of this
repository. They belong to Meta's official API, integrated directly in Shop-AI.

## Decisions needed before any live work

The first four block Phase 2. A "no" on D1 or D2 ends this plan: see
[Stop conditions](#stop-conditions).

| # | Decision | Why it matters | Recommendation |
| --- | --- | --- | --- |
| D1 | Do current Meta terms allow this, and who accepts the risk? | The feasibility report says NO-GO for production sending until this is positive. An always-on connection also goes beyond its "on-demand, low-volume" posture | Owner reviews before Phase 2; get legal advice if the shop depends on it |
| D2 | Which account carries the risk? | A restriction could also stop official-API publishing on the same account | Accept losing that account as the worst case, or do not use the shop's main account |
| D3 | Real-customer data rules | Real chats hold other people's data: lawful basis, retention, deletion | Decide retention and deletion before Phase 6 |
| D4 | A third owner-controlled test account and a second consented chat | New-chat and multi-chat behavior cannot be observed with one existing chat | Add account C; update `AGENTS.md` scope when approved |
| D5 | Batch approval for test scripts | Soak tests need many messages, and each needs exact approval | Owner approves a written list of sender, recipient, exact text and count per run |
| D6 | May session data move to the homelab? | Earlier transfer was rejected for lacking explicit destination approval, and homelab use is untested | Approve transfer to that destination, in private storage only |
| D7 | May the AI send without a person? | Repository rules require per-message approval for live tests; production policy is undecided | AI drafts, staff approve. Revisit after Phase 6 |

### Decisions recorded on 2026-11-07

Handles stay out of this file because `AGENTS.md` forbids committing account
identifiers. Each decision below grants only what it states.

| # | Status | Recorded decision |
| --- | --- | --- |
| D1 | Decided by owner | Owner states Meta's terms allow this use and accepts the risk. No supporting document was supplied or checked, so this is the owner's determination rather than a verified terms review |
| D2 | Decided by owner | The owner-named account carries the risk, and its loss is accepted as the worst case |
| D3 | Open | Needed before Phase 6 |
| D4 | Decided by owner | The owner named three controlled accounts: the shop's account (A, also the D2 risk account) and two customer accounts (B, C). C has never messaged A. `AGENTS.md` scope now covers them; handles stay out of the repository |
| D5 | Decided by owner | Batch approval is accepted. Each run still needs its own written list of sender, recipient, exact text and count, approved before that run. No list has been approved yet |
| D6 | Open | Needed before Phase 5 |
| D7 | Open | Needed before any AI send |

Because the main test account is also the risk-bearing account, a mistake or an
enforcement action during testing affects that same account.

## Hard limits

These stay true in every phase:

- The owner signs in and handles challenges. No login automation, challenge solving
  or forced session expiry on a shared browser.
- A login challenge or access barrier stops the work. It is not a problem to engineer
  around.
- No evading rate limits or anti-automation checks. Keep request pacing.
- Never retry an uncertain send. Duplicates to customers are worse than a visible
  "check this chat" state.
- No bulk messaging, and no messaging people who have not contacted the shop first.
- Credentials and message contents stay out of Git, logs and persistent indexes.
- No protocol code from guesses: observe first, as `AGENTS.md` requires. Only Phase 1
  may proceed without new observation.

## Gaps

| Gap | Today | Best lead | Phase |
| --- | --- | --- | --- |
| Non-text message breaks a read | `parseMessageList` throws on a missing `text_body`; the receiver stops with `protocol-rejected` | Offline test showed the throw with a synthetic photo | 1, 3 |
| Customer name and avatar | Threads return only `id`; messages only `senderFbid` | `WmiSlideAsyncFetchAndInsertThreadQuery` returns members (OBSERVED) | 3 |
| New customer's first message | Receiver needs a known `threadId`, and others are dropped | Subscription can hold mailbox-wide deltas (documented). Mailbox `folder` variable hints at a separate requests folder (HYPOTHESIS) | 3, 4 |
| Only one chat works per capture | Pagination and send are tied to a captured chat | Rewriting `thread_fbid` is untested for other chats | 3 |
| Mailbox paging | Cursor variable unknown, never run live | Needs observation | 3 |
| Receive and send photos | Unsupported | `wmiSlideSendMediaMessage`, `useBarcelonaMessagesSendMedia` (static only) | 3 |
| Reactions, read state, unsend, edit | Ignored | `WmiSlideThreadMutationsMarkReadMutation` (OBSERVED); `wmiSlideSendEditMessage` (static); delta `__typename` dispatch | 3 |
| Quote replies | Sender rejects `replied_to_message_id` | Variable exists in the observed mutation; value never seen set | 3 |
| Stream dies on any drop | No reconnect; needs fresh browser packets | Whether Node can start a subscription alone is unknown. This is the hardest gap | 4 |
| Restart-safe receiving | In-memory dedupe, 10,000-ID limit stops the receiver, async callbacks not serialized, rejection loses the event | Host-owned checkpoint plus read reconciliation | 1, 4 |
| Session capture | No tool in the repo; old helpers were in `/private/tmp` | Prior in-memory broker design | 5 |
| Real expiry and renewal | Never observed; tokens change on reload; rejection code does not prove expiry | Needs a real lifetime measurement | 5 |
| Protocol changes | Persisted `doc_id` values captured, drift undetected | Fail closed and report as a distinct error | 5 |
| Linux and homelab | Live runs only on macOS arm64 | Blocked on D6 | 6 |
| Durable send state | Journal keeps status only; `acknowledged` loses the provider message ID | Shop-AI's database should own attempts | 1, 7 |

## Phases

Sizes are rough guesses. Phases 3 to 5 depend on what the experiments find.

### Phase 1: Offline hardening (small, safe to start now)

No live traffic and no new approvals.

**Status, 2026-11-07: committed. Images and shared posts are verified live (E11).**
Other kinds stay `unsupported`; a node without a message ID, sender or timestamp
still fails closed.

- Replace "throw on non-text" with a message union: `text` and `unsupported`. An
  `unsupported` message keeps its ID, sender and time, so the inbox can say "open in
  Threads" and a customer's photo never takes the chat down.
- Receiver: unknown message kinds and unknown delta types stop being fatal. Malformed
  framing stays fatal.
- Receiver: run callbacks one at a time and wait for each. Report a failed callback
  with its message ID so the host can recover it by reading.
- Replace the fatal 10,000-ID limit with oldest-first eviction. Durable dedupe belongs
  to the host's database.
- Return the provider message ID on acknowledged sends so the host can persist it.
- Add synthetic tests for all of the above, plus a mixed text and photo page.

**Done when:** `pnpm typecheck`, `pnpm test`, `pnpm build` and `verify:package` pass,
and a synthetic photo no longer fails a read or stops a receiver.

### Phase 2: Evidence sprint (medium, needs D1, D2, D4, D5)

One controlled run per experiment, recording sanitized shapes only. Results go in
`docs/experiments.md` and `docs/protocol-map.md`.

| ID | Question | Method |
| --- | --- | --- |
| E11 | What do non-text messages look like, in reads and deltas? | Ran 2026-11-07 for image, link and shared post in live deltas (`E11-NON-TEXT-20261107`). The owner then limited SDK support to images and shared posts; the compiled SDK read and received both live (`E11-SDK-NON-TEXT-20261107`). Links read as `text` but arrive live as `unsupported`. Story replies, video, voice and stickers are untested |
| E12 | Where do name, username and avatar come from? Is the ID stable? | Observe the members query and thread list fields in the owner's browser |
| E13 | How does the mailbox page, and which folders exist? | Observe inbox scrolling and folder switching |
| E14 | What happens when a new person writes first? | Ran 2026-11-07 (`E14-NEW-CHAT-20261107`): the first message landed in **Message requests**. A rerun with the receiver already connected saw nothing from it in 15 minutes (94 frames, connection alive): **the captured subscription does not carry Message requests.** Next: observe how the browser lists requests, and what accepting changes |
| E15 | Can one session serve many chats? | Read and send in the second chat by substituting `thread_fbid`, and find how to obtain the Relay node ID |
| E16 | What do edits, unsends, reactions and read receipts emit? | One action each, observing delta `__typename` |
| E17 | How do photo upload and send work? | One approved UI image send; record the upload and mutation shape |
| E18 | How do quote replies and mark-read work? Do SDK reads mark a chat read? | One approved quote reply; observe mark-read; compare read state after a Node read |
| E19 | Can Node open a new subscription with no browser? | Partly, 2026-11-07 (`E19-REUSED-SETUP-20261107`): a new receiver reusing 5-minute-old setup packets connected with no browser and received a message. Untested: older packets, after a provider drop or browser close |
| E20 | How long does a session last, and what ends it? | Low-frequency owner-initiated reads over days, noting the signal at real expiry and after a browser logout |

**Done when:** each row has an evidence level and a written result, including "not
possible". Revisit the rest of the plan then, since the results may change it.

### Phase 3: Complete conversation data (large, needs E11 to E18)

- `listConversations` returns participants, last activity and unread state, with
  verified mailbox paging and the requests folder if E14 shows one.
- `getMessages` works for any chat from one session, without a per-chat capture.
- The message union gains the kinds E11 observed. Media gets a documented way to
  fetch files before their URLs expire, since Shop-AI must store its own copy.
- `sendText` gains quote replies. `sendImage` is a single attempt with the same
  never-retry rules. `markRead` is added.
- Reaction, unsend and edit events are added where E16 shows them. Anything unobserved
  stays absent, and the capabilities object reports it as unsupported.
- Fixtures stay synthetic, shaped from sanitized observations.

**Done when:** each new method matches a fresh browser baseline in a controlled run.

### Phase 4: Always-on receiving (large, highest risk, needs E14, E19)

- One receiver per account, covering all chats. It reports `thread.new` for unknown
  chats instead of dropping them.
- Reconnect after drops with capped backoff. Which design applies depends on E19:
  - **Node can subscribe alone:** the SDK reconnects by itself.
  - **It cannot:** reconnecting needs fresh packets from the owner's open browser, so
    the capture tool in Phase 5 supplies them. If that browser is closed, the inbox
    shows "disconnected". This weakens the product; see [Stop conditions](#stop-conditions).
- After every reconnect, reconcile through a bounded read of recently active chats, at
  normal pacing, then emit only what the host has not seen.
- Delivery is at-least-once: the host persists first, then acknowledges by advancing
  its checkpoint. A crash replays events, and the host dedupes on message ID.
- A `connection.state` event gives the inbox a truthful status: `live`,
  `reconnecting`, `needs-owner`.

**Done when:** synthetic tests cover drop, restart and duplicate cases, and a
controlled run shows a message sent during a stop is delivered exactly once to the host.

### Phase 5: Session lifecycle (medium, needs E20, D6)

- A supported capture command, run by the owner, attaches to their existing Chrome
  (`--autoConnect`), reads current session state in memory, checks the account, and
  hands it to the host. It never logs in or answers a challenge.
- Secure delivery to the host, in private storage only, per D6.
- One session per Threads account, so each Shop-AI shop stays separate. Replacing a
  session updates reader, sender and receiver together, unlike today's separate
  lifecycles.
- Renew tokens only if E20 shows a normal client path that needs no login. Otherwise
  stop and raise `needs-owner`.
- Distinct errors: `needs-owner`, `challenge`, `protocol-changed` (an unknown response
  shape or rejected `doc_id`), `rate-limited`, `unavailable`. Each one pauses work and
  never retries a send.

**Done when:** an owner can reconnect in under two minutes by following a runbook,
tested through one real expiry.

### Phase 6: Production proof (medium, needs D3, D6)

- CI and the package smoke test on Linux. Shop-AI's image must run Node 24.22.1 or
  newer, since the SDK requires it; the current pinned image version is unchecked.
- E21: reads from the homelab, one at a time. **A challenge stops this test.** If the
  homelab is challenged, the fallback is to run the connection on the owner's machine
  over Tailscale, not to work around the challenge.
- E22: a 14-day soak with test accounts, a scripted set of approved messages, and an
  independent receipt log.
- Terms re-check, then release `1.0.0-rc` through the existing private release flow.

### Phase 7: Shop-AI integration (separate task, in `tiemdosime-bot`)

Not done in this repository. This phase needs its own explicit task, and the SDK stays
unaware of Prisma, commerce and the admin UI.

- Refresh `docs/shop-ai-integration.md` first. It predates multi-shop: uniqueness is
  now per `shopAccountId`, and `ShopAccount.instagramAccountId` is still required.
- Add the `THREADS` channel, provider-neutral identity and message IDs, and a channel
  dispatcher, including `agent/graph/nodes/send-reply.ts`.
- Run the connection in one dedicated internal container, following the
  `private-sidecar` pattern, so API deploys do not drop it and only one receiver runs.
- Roll out: read-only with AI off, then staff-approved replies after D1, then whatever
  D7 allows.

## Target API

Names are illustrative until the evidence confirms each shape.

```ts
const channel = createThreadsChannel({ session, checkpoint, onEvent });

channel.capabilities;                       // only what has been verified
await channel.listConversations(cursor);    // participants, activity, unread
await channel.getMessages(threadId, cursor);
await channel.sendText(threadId, text, { replyTo });  // single attempt, never retried
await channel.sendImage(threadId, file);
await channel.markRead(threadId);
await channel.start();  await channel.stop();
channel.replaceSession(session);

// message.new | message.changed | message.removed | reaction | read
// thread.new | connection.state
```

## Exit criteria

Proposed numbers; the owner may change them before E22 starts.

| Measure | Target over the 14-day soak |
| --- | --- |
| Messages lost after reconciliation | 0 |
| Duplicate sends | 0 |
| Duplicate messages reaching the host's database | 0 |
| New-chat first message appears in the inbox | Under 1 minute while connected |
| Time to detect a dead connection | Under 1 minute |
| Owner reconnect actions | At most 1 per week |
| Login challenges or account warnings | 0 |
| Message kinds crashing a read or receiver | 0 |

## Stop conditions

Stop and report rather than pushing on:

- D1 or D2 is "no".
- Any account warning, restriction or repeated challenge. Stop all live use on that
  account until the owner decides.
- E19 fails **and** the owner's browser cannot reasonably stay open. A channel that
  misses customers without warning would be the half-built product this plan is meant
  to avoid.
- E14 shows new customers' messages cannot be seen or answered.
- E20 shows sessions last too short to meet the reconnect target.

**Fallback:** ship the official-API side alone (posts, replies, insights), and direct
DM customers to the Threads app. That still gives Shop-AI a real Threads presence.

## Order

```
Phase 1 --> D1,D2,D4,D5 --> Phase 2 --> review --> Phase 3 --+
                                                  Phase 4 --+--> Phase 6 --> Phase 7
                                                  Phase 5 --+
```

Phase 1 can start now. The D1 terms review should happen before spending on Phase 2,
because a "no" there makes everything after Phase 1 unnecessary.
