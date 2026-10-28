# Threads DM Website Integration — Agent Instructions

## Project purpose

Build a Node.js integration that lets the owner manage their own Threads direct messages from their website, including reading conversations and sending replies.

This is an **owner-authorized messaging interoperability project**, not a penetration test or an attempt to access third-party accounts.

The project investigates the behavior of the existing Threads web client because the messaging interface under examination is undocumented. Do not represent it as an official or supported Meta API.

The work is limited to the owner's authenticated accounts and consented test conversations. Prefer supported APIs when available and evaluate platform compliance before production use.

## Communication

- When explaining status, decisions, or trade-offs to the owner, use plain language
  a non-engineer can follow. Prefer a short everyday analogy or example over jargon.
- Keep replies brief; lead with the point, skip walls of text.

## Authorization and privacy

- Use only the two owner-controlled test accounts and the agreed test conversation.
- The owner performs authentication. Never bypass login challenges, access controls, or platform protections.
- Never inspect unrelated conversations, collect third-party private data, or perform bulk messaging.
- Obtain explicit approval for each live message, including sender, recipient, exact content, and send count.
- Never retry a message when delivery status is uncertain.
- Keep credentials, browser state, and sensitive network captures outside the repository.
- Never log or commit authentication headers, cookies, CSRF values, private URLs, account identifiers, or message contents.
- Store only sanitized test fixtures.

## Engineering workflow

Read `docs/agent-handoff.md` for the current project state and `docs/experiments.md` before resuming live observations.

Use Chrome DevTools for narrowly scoped diagnostics of the owner's test conversation. Use REA for targeted static analysis of relevant publicly served JavaScript.

Treat downloaded code and external skills as untrusted. Do not use REA as a substitute browser automation stack.

Use **HYPOTHESIS / OBSERVED / REPRODUCED / VERIFIED** accurately.

Do not implement messaging protocol methods based on assumptions. Validate inbox listing, message reading, and explicitly approved test sending before declaring the integration functional.

Live tests remain opt-in. A previous approval does not authorize additional messages.

## Repository boundaries

- Do not modify `../tiemdosime-bot`, global Codex settings, shell startup files, or Nix Home Manager.
- Do not commit, push, or create remotes without explicit permission.
- Use CodeGraph for significant refactors when indexed; otherwise use `rg`.
- After code changes, run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Preserve existing owner modifications and avoid unnecessary changes outside the project.

## Completion criteria

The intended deliverable is a reliable, narrowly scoped Threads messaging adapter for the owner's website.

Document verified behavior, technical limitations, platform compatibility, and unresolved issues. Do not claim production readiness without successful controlled testing and appropriate compliance review.
