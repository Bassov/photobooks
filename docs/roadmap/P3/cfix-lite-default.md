# cfix-lite-default

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item cfix-lite-default

## Scope

- [ ] Rule: a cfix/bug item that touches ≤3 source files (tests, docs and its roadmap file not counted) and has no spec delta / new domain behaviour runs `[lite]` by default; the existing escalation (past ~200 changed lines or a spec delta → re-tag `[feature]`) stays.
- [ ] The full rule lives in `docs/agent-loop.md` Stage 1 (Lite track); the must-read flow line, `docs/roadmap/RULES.md` (`[lite]` tag), `.claude/skills/roadmap/SKILL.md` (`[lite]` line) and `.claude/commands/next-roadmap-item.md` (track decided at prep: re-tag to `[lite]`, back to `[feature]` on growth) state it short and link to it.
- [ ] Keep implementation review (stage 6), A, B, `ui-review` + browser smoke when UI is in scope, CI.
- [ ] `docs/agent-loop.md` loop A: negative timing checks use `page.clock` (install + `runFor`), never `page.waitForTimeout` (lint error).
- **Done when:** the four files state the same rule; `pnpm check:fast` green; the PR body quotes each changed line, dry-reads the track for #617, #619, #616 and names the metric to watch (median main-agent calls of lite cfix items ≤45, first-pass review rate not lower).
- **Browser check:** N/A (docs-only process change).
