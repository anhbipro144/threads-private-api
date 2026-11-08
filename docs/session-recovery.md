# Session handling and send recovery

Implemented and tested offline after the owner-accepted local milestone.
The website prototype remains retired. No live experiment, login, session export
or message send was performed for this work. Genuine session expiry and machine
power-loss behavior have not been exercised.

## In-memory session lifecycle

`ThreadsDmReader.sessionStatus` reports:

| State | Meaning |
| --- | --- |
| `configured` | Owner supplied a session; no successful read with it yet |
| `ready` | A GraphQL read succeeded with this session; not a promise about its lifetime |
| `reconnect-required` | HTTP 401/403 or the observed numeric HTTP-200 rejection envelope was returned |
| `disconnected` | The caller explicitly removed the managed session |

After rejection, further calls fail locally with `ThreadsAuthRequiredError` and
make no provider request. A concurrent success cannot clear this state. Generic
network, HTTP-500 or GraphQL errors do not falsely mark credentials rejected.
The numeric rejection envelope may concern auth/request validation; it does not
prove that the session expired.

The owner completes authentication and supplies fresh captured material through
the existing approved memory-only workflow. Call:

```ts
reader.replaceSession(sessionFromCapturedForms(freshOwnerCapture));
```

This resets the state to `configured`; an owner-initiated read can validate it.
No request, login or retry happens automatically. `reader.disconnect()` clears
the managed session. Already-issued reads may finish, but their responses/errors
are discarded if the session was replaced or disconnected. Queued reads build
their request from the current session at dispatch time. Reader request spacing
remains in force across replacements.

For a send auth rejection, `ThreadsSendOutcomeUnknownError.reconnectRequired`
is true while delivery remains unknown. The handler returns `reconnectRequired:
true` with that result, then blocks new drafts and other unattempted confirmations
with 503 `threads_reconnect_required`. It continues to expose consumed outcomes.
Never turn this flag into permission to retry an attempted message.

After owner reconnection, replace the read session, validate a controlled read,
then create a fresh send handler with the new capture callbacks and the **same
journal**. Old pending drafts disappear and require fresh review. Old attempted
IDs can recover status but cannot send. Disable sending until the replacement
read is `ready`; a capture callback can enforce that before returning any material.
Do not mutate an existing attempt to inject new credentials.

## Session file and capture command

`saveThreadsSession(file, session)` writes one account's capture (`ThreadsStoredSession`:
reading forms, the Message requests form and receiver setup) atomically at mode 0600.
The directory must already exist, belong to the user and be closed to everyone else.
`loadThreadsSession(file)` refuses links, files others can read and malformed contents,
with an error that names no path. Keep the file outside every repository; one per account.

From a checkout of this repository, the owner or an authorized agent runs, with
Chrome open and logged in:

```sh
pnpm capture-session --username <shop account> --out <absolute file> [--thread <chat id to open>] [--with-send (requires --thread)]
```

It attaches to that Chrome (Chrome asks the owner to allow it), opens its own tab, confirms
the account, opens one chat (which marks it read) and the Message requests folder, and builds
the inbox form from the requests form with `folder: "INBOX"` (the inbox list request does not
fire in the page; E21). It then saves the file, then checks it with one inbox read and one receiver connection. It prints
only step results, never session values. It never logs in or answers a challenge: if the tab
is not logged in as that account, it stops. Without `--with-send`, it captures reading
and receiving only. Mark-read capture is not included.
Run it again to replace an expired session.

### Optional send template

Use this step when the host needs to reply from the saved session. **You or an
authorized agent type and send one real message in the capture tab** to an agreed
test customer; the command only observes. In this repository, the agent may operate
as main test account A in its two agreed chats; using customer account B or C
requires asking the owner (`AGENTS.md`). For example,
replacing the placeholders with your account, private file and test chat:

```sh
pnpm capture-session --username <shop account> --out <absolute file> --thread <test chat id> --with-send
```

`--with-send` requires `--thread`. The capture tab opens in the foreground. After the
reading and receiver setup, it opens the named chat and prints one prompt. Send one
plain text there within 3 minutes, with no quote, mention or attachment. The command
does not type, click Send or send a message itself. Opening the chat marks it read.

It takes the first new text-send request and validates that it targets the opened chat.
The sender ID comes from the first inbox page's member matching the captured username.
Only then does it save the session, including `send` (the observed form, its headers
and sender ID). The typed text is replaced by `Captured plain-text template`.
The file still contains private session credentials; keep it outside repositories.

On success, `sendTemplateCaptured true` appears before saving. After loading the saved
file, the command constructs an attempt for another inbox chat (or the captured chat
when it is the only one) and prints `sendTemplateUsable true`. It never calls `send()`;
the operator's one message in the tab is the only send during capture. Normal inbox and receiver
checks also run. Without the flag, no send prompt or send-template steps appear.

Failures save nothing and leave any existing session file in place:

- `sendTemplateMissing; nothing saved`: no text-send request within the wait, including
  an attachment-only send. Do not send after the wait ends.
- `sendTemplateUnusable; nothing saved`: wrong chat, quote, mention or malformed template.
- `senderUnconfirmed; nothing saved`: no matching account member in the first inbox page.
- `capture incomplete; nothing saved`: required reading or receiver setup is missing.

No failure retries a message. A capture failure does not undo the operator's message;
check the chat before deciding on any later test.

## Optional durable send journal

`createThreadsSendHandler({ ..., journal })` enables recovery. Without a journal,
the existing process-local guard remains unchanged. Initialize the file journal
with an absolute owner-configured directory outside every repository and shared
folder. Its parent must already exist:

```ts
const journal = await createFileThreadsSendJournal(privateJournalDirectory);
const handler = createThreadsSendHandler({
  authorizeOwner,
  websiteOrigin,
  conversations,
  journal,
});
```

The journal directory is private (0700), regular state files are private (0600),
and existing directories/files must belong to the process owner. Symlink state
files and a symlink journal directory are refused. Use a local filesystem that
supports exclusive creation, atomic rename and file/directory fsync. Network
filesystems, Windows and loss of the journal volume are not covered. Never use
the repository or put session files alongside these records.

The only persisted data is a random UUID draft ID in the filename and one status
word: `attempted`, `acknowledged` or `unknown`. No credentials, captured forms,
account IDs, provider message IDs, message text, private URLs or identity labels
are written. The adapter creates no default storage location and stores no login.

Before dispatch, the handler exclusively creates and syncs a durable claim. If
claiming fails, it sends nothing and returns 503 `threads_send_journal_unavailable`
with `doNotResend: true`. A competing claim cannot dispatch another request.
After the request, the terminal status is atomically written and synced. Failure
to save the final status leaves the already-consumed claim; it cannot permit a
retry. Empty/partial claim files recover as unknown; unsafe files fail closed.

After a restart, confirming an old attempted ID returns its recovered status
without preparing an attempt or contacting Threads:

- `acknowledged`: 200, `recovered: true`, `requiresReceiptCheck: true`. Provider
  message identifiers were not saved, so no acknowledgement object is returned.
- `attempted` or `unknown`: 202 `status: unknown`, `recovered: true`,
  `requiresReceiptCheck: true`. Check receipt; never resend.
- No record: 404 `draft_not_found`, `doNotResend: true`. Unattempted drafts were
  memory-only; do not reconstruct or confirm them automatically.

Journal records do not expire automatically. Deleting/restoring the journal can
lose recovery evidence, so do not rotate or prune it as ordinary cache. Losing a
journal must not cause the host to recreate and resend an uncertain message.
This does not deduplicate a different new draft ID or establish server-side
deduplication. Active drafts are still process-local, so general multi-instance
request routing is not implemented. Owner confirmation and independent receipt
checks remain required for every live test.

## Checks

Synthetic tests cover rejection/replacement/disconnect, stale responses, queued
reads, concurrent rejection, send reconnect signals, journal failure before
dispatch, lost final-status writes, handler reopening, private permissions,
symlink refusal and partial records. Two independent Node processes race to
claim one ID; exactly one succeeds, and reopening recovers the consumed claim.
These are local process/filesystem tests, not proof of power-loss behavior or
live service expiry. The previously observed message operations are unchanged.
