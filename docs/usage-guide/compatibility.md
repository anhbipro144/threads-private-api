# Compatibility and validation

Requires server-side ESM on Node 24.22.1+ within Node 24. Compiled JavaScript and
TypeScript declarations ship together. No runtime npm dependencies or browser
binaries. The bundle is not a browser SDK.

| Behavior | Evidence / boundary |
| --- | --- |
| Inbox and message reads | Node with Chrome closed matched fresh browser baselines |
| Older messages | Two bounded pages and explicit SDK calls matched; automatic full-history/default-UI/mailbox pagination not live-verified |
| Text send | One approved Node send, validated acknowledgement and independent receipt |
| Incoming text | Compiled SDK event matched a read after DevTools disconnection/owned-tab closure; Chrome stayed open |
| Idle listening | 900 seconds ready without failure/reconnection; no load/activity during interval |
| Manual recovery | One stopped-gap message recovered by read, fresh baseline/subscription accepted, later new event received after a fresh manual connection |
| Durable send status | Synthetic filesystem/process tests; not genuine power loss |
| Real expiry / automatic recovery | Unverified; no automatic login/reconnect/resnapshot |

Live observations used macOS arm64 and Node 24.22.1. Offline install on another
host does not prove provider compatibility there. Journals require private
permissions and atomic/durable filesystem operations; Windows and multi-instance
guarantees are not established.

Unsupported/unverified: arbitrary recipients, bulk messaging, media, reaction/
edit/delete synchronization, reverse/mailbox pagination, browser-closed push,
general exactly-once delivery, genuine expiry and continuous production use.

This is an unofficial interface. Review platform terms and account-enforcement
risk before production. A release is a compatibility checkpoint, not proof that
the undocumented upstream protocol will remain stable.
