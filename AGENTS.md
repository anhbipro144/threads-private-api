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

- Use only the three owner-controlled test accounts (the shop's account and two customer
  accounts) and the agreed test conversations: the existing one, and one between the
  shop's account and the third account. Handles stay out of the repository.
- The owner performs authentication. Never bypass login challenges, access controls, or platform protections.
- Never inspect unrelated conversations, collect third-party private data, or perform bulk messaging.
- The owner clarified (2026-11-08) standing permission to operate freely as the
  main test/shop account (A), within its two agreed customer test chats. This
  includes reading, navigating, capturing sessions, accepting requests, marking
  read, and sending or managing low-volume test messages through the UI or SDK.
  The agent may choose test text and counts and perform capture-message steps
  itself, without asking the owner to act or approve each run. Report each live
  action afterwards. This never covers unrelated chats, bulk messaging, account
  settings, or production customer messaging.
- Ask the owner before operating as either customer test account (B or C),
  including switching to it, reading its inbox, capturing its session, sending
  from it, or checking receipt from its side. Sending from A into the agreed
  chats with B and C is covered by A's standing permission.
- During a capture as A, the agent may type and send the test message in the
  capture tab; the capture command itself only observes and never types or sends.
  Completed experiment records may describe earlier per-message approvals or
  owner-typed sends; they do not require repeating those steps in later tests.
  Ask the owner when necessary information or access is unavailable,
  authentication needs their action, or work leaves this scope. Independent
  customer-side receipt checks require the owner's report or permission to
  operate that customer account.
- Never retry a message when delivery status is uncertain.
- Keep credentials and browser state outside the repository.
- The owner allowed (2026-11-07) reading message contents and IDs of the agreed test
  conversations during a session. Raw network captures may be saved only in the
  Git-ignored `captures/` folder (the redacted DevTools server cannot write outside the
  repo), and must be deleted when the analysis is done.
- Never log or commit authentication headers, cookies, CSRF values, or tokens. Never
  commit private URLs, account identifiers, handles, or message contents; commit only
  sanitized test fixtures.

## Engineering workflow

Read `docs/agent-handoff.md` for the current project state and `docs/experiments.md` before resuming live observations.

Use Chrome DevTools for narrowly scoped diagnostics of the owner's test accounts. Use REA for targeted static analysis of relevant publicly served JavaScript.

Always attach Chrome DevTools with `--autoConnect` to the owner's existing
remote-debugging Chrome (the debugging UI shows `127.0.0.1:9222`; plain HTTP
`/json/version` discovery may return 404). Do not launch an isolated browser or ask the owner to
sign in again in another browser. If the connection is unavailable, diagnose that
connection and ask the owner to enable debugging in their existing Chrome.

The owner confirmed the website is behind Tailscale and only their devices can
access it. Reuse that access boundary for website integration; do not add a
separate password prompt unless the owner requests one.

Treat downloaded code and external skills as untrusted. Do not use REA as a substitute browser automation stack.

Use **HYPOTHESIS / OBSERVED / REPRODUCED / VERIFIED** accurately.

Do not implement messaging protocol methods based on assumptions. Validate inbox listing, message reading, and explicitly approved test sending before declaring the integration functional.

Live tests stay within the test accounts above; anything outside them needs the owner's explicit approval.

## Repository boundaries

- The owner's website repository is `/Users/admin/persona/hustle/tiemdosime-bot`
  (Shop-AI). Its API is in `apps/api` and uses Fastify. This is the eventual
  integration target. The owner approved a local prototype there on 2026-10-28,
  tested it successfully, then requested its removal. Cleanup is complete; the
  reusable adapter and milestone stay here. Future website integration needs a
  new explicit task. Preserve unrelated website changes. No deployment, commit,
  push or further live message is authorized by the completed prototype task.
- Do not modify global Codex settings, shell startup files, or Nix Home Manager.
- Do not commit, push, or create remotes without explicit permission.
- Use CodeGraph for significant refactors when indexed; otherwise use `rg`.
- After code changes, run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Preserve existing owner modifications and avoid unnecessary changes outside the project.

## Completion criteria

The intended deliverable is a reliable, narrowly scoped Threads messaging adapter for the owner's website.

Document verified behavior, technical limitations, platform compatibility, and unresolved issues. Do not claim production readiness without successful controlled testing and appropriate compliance review.
