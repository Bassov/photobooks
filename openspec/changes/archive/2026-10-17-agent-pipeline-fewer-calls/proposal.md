# Proposal

## Problem

Every Cursor model call re-sends full context, so cumulative input ≈ calls × context size. After #77 shrinks context, `/next-roadmap-item` still burns calls on multi-step preflight, finish (push/PR/CI), and reviewer-brief assembly (issue #79; ~66 main calls on `agent-rules`).

## Why now

Call count is the remaining lever; composite `pnpm agent` stages cut happy-path calls before more M2.1 items run.

## Scope in

- `scripts/agent.mjs` + `pnpm agent`: `preflight`, `finish`, `review-brief`; `--json` / short success; no ANSI when `CI`/`--quiet`
- Wire `next-roadmap-item.md` to those commands + batching; compact agent/roadmap output; `AGENTS.md` Commands + minimal MCP surface
- `agent-context` delta for composite stages, batching, MCP note
- Tests at roadmap CLI bar; no gate weakening

## Scope out

- Call-count transcript measurement and rtk-oss trial/adopt (`agent-pipeline-call-count-check`); closing #79
- #78 / `docs/lessons.md`; app `src/`; new npm deps; changing CI gates

## Success criteria

- `pnpm agent preflight|finish|review-brief` exist with tests; command uses them
- Compact/`--json` behavior; MCP minimal set in AGENTS; `agent-context` covers composite stages + batching
- `pnpm verify:fast` green; PR cites https://github.com/Bassov/photobooks/issues/79; does not close #79

## Risks

- Soft batching/MCP guidance ignored — mitigate with one-call composite CLI for mechanical stages
- `finish` scripting git/gh wrong — mitigate: no auto-commit message; mocked child processes in tests; ≤2 push attempts

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: composite agent stage commands, batching, MCP surface for unattended pipeline
