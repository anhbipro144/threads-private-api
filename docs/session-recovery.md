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
