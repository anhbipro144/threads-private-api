---
name: save-progress
description: Save a resumable Markdown handoff when the user asks to save project progress, is running out of usage, or wants another agent to continue. This is a checkpoint workflow, not authorization to continue live experiments.
---

# Save progress

Update `docs/agent-handoff.md` as the canonical handoff for this repository.
Read the current user request, `AGENTS.md`, existing handoff and relevant findings;
preserve the latest scope and corrections instead of replaying conversation history.

- Stop starting new live actions. Collect already-running results when safe;
  document unresolved operations and owned tool/session IDs. Never retry an
  uncertain send or terminate a shared browser merely to make a checkpoint.
- Record what is complete, the evidence and its confidence, current blockers,
  the exact next actions, and any pending user answers. Distinguish browser UI
  success, standalone Node reproduction, static inference and independent receipt.
- Record authorization precisely: sender/recipient labels, approved count,
  whether it was consumed, and what needs fresh approval. A saved plan grants
  no new permission; current user instructions take precedence when resuming.
- Include relevant repository files, uncommitted/user-owned changes, external
  artifact paths, source hashes/Evidence IDs, useful commands and the last checks
  actually run. Note ephemeral files and live sessions that may no longer exist.
- Keep credentials, tokens, account IDs, message contents, private URLs, browser
  state and raw traffic out of the Markdown and persistent context index. Link
  private artifact paths with handling warnings; never copy their contents.
  Drop owned transient private references once no active action needs them.
- Make the next agent's first steps concrete. Preserve failures and their causes
  when they prevent repeated work, including approval rejections and safer paths.
  Avoid repeated chronology, speculative conclusions and unrelated backlog.
- Preserve other people's working-tree changes. Do not commit, push, change
  global settings, expand scope or mark incomplete work complete to save progress.
- Verify links and `git diff --check`. Report previous test results accurately;
  do not rerun expensive/live checks just to write a documentation checkpoint.

Keep this skill self-contained. Add helpers only if saving progress demonstrates
a repeated mechanical need. Finish with the handoff and local skill paths plus
the most important unresolved prerequisite.
