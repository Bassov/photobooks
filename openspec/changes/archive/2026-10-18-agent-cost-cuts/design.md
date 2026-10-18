# Design

## Context

Unattended runs re-read OpenSpec config/skills/agents and run two planning reviewers. Lane is rules/pipeline only; gate-values and codecov sessions own other files. No new dependencies.

## Goals / Non-Goals

**Goals:** one planning review; preflight run card + `agent instructions`; cli.json deny-adds; exploration defaults; `agent stats` with thresholds + fixture test.

**Non-Goals:** nested scratch `/next-roadmap-item` measurement (reviewer); package.json script if `pnpm agent stats` already works via agent CLI; app UI; weakening existing denies.

## Decisions

1. **Single reviewer agent** — Add `.cursor/agents/openspec-planning-reviewer.md` whose Checks include the full proposal checklist and the full design checklist (docs-only / missing `design.md`: skip design section only). Launch once after proposal + design + tasks + specs (when not skipped). At most one delta re-review for that planning stage. Update `openspec/config.yaml` and `next-roadmap-item.md`; drop mandatory separate proposal/design launches. Old agent files become one-line redirects. Point implementation-reviewer check 6 at the planning reviewer (wording only).
2. **Brief `--out`** — Extend `review-brief` with `--out <file>`; parent passes path only to the Task prompt.
3. **Run card** — Preflight loads ready artifacts via existing `openspec instructions` inside the CLI, embeds template/rules + fixed ≤10-line apply/archive procedure. `pnpm agent instructions <artifact> [--change S]` wraps the same. Text and `--json` both expose the card.
4. **cli.json denies (item-exact, deny-last)** — Add only: `Shell(openspec:instructions*)`, `Read(openspec/config.yaml)`, `Read(.cursor/skills/openspec-*/**)`, `Read(.cursor/agents/**)`. Never weaken existing denies. **Apply order:** edit config/agents/command/AGENTS/scripts first; add cli.json denies in the last implementation task so this PR can still Read those paths while applying. After merge, agents rediscover rules from the run card / `agent instructions`; rare pipeline edits of denied paths use targeted `rg`/offset Shell patches (allowlisted) rather than full-file Read.
5. **Exploration** — Short bullets in `AGENTS.md` (≤150 lines) and in the run-card procedure: grep ≤30, offset/limit >400 lines, no re-read, no TodoWrite in `-p`, Task shape = skill + brief path.
6. **Stats format** — Zero-dep Node. Path may be JSON `{rounds:[{input,output,cacheRead,modelCalls,context}]}`, JSONL of those objects, or SQLite `store.db` whose `meta` JSON has `agentStats.rounds` (same shape). Use `node:sqlite` (Node 22). Print per-round lines + peak; exit 1 if `max(context)>300000` or `rounds[0].input>400000`; invalid → exit 2. Tests: tmp JSON/JSONL/SQLite fixtures (including peak >300K → exit 1).

## Risks / Trade-offs

- Post-merge full Read of config/agents is denied — mitigated by run card + deny-last this PR + targeted Shell edits for rare follow-ups.
- `node:sqlite` experimental — lock behaviour with fixtures on Node 22.

## Touch-set

| Path                                                 | Reason                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `openspec/config.yaml`                               | Single planning-review rules; verification checklist wording |
| `.cursor/agents/openspec-planning-reviewer.md`       | New merged reviewer (full proposal+design checks)            |
| `.cursor/agents/openspec-proposal-reviewer.md`       | Redirect stub                                                |
| `.cursor/agents/openspec-design-reviewer.md`         | Redirect stub                                                |
| `.cursor/agents/openspec-implementation-reviewer.md` | Point check 6 at planning reviewer                           |
| `.cursor/commands/next-roadmap-item.md`              | One planning review; run-card hygiene                        |
| `.cursor/cli.json`                                   | Deny-only adds for listed paths (last task)                  |
| `AGENTS.md`                                          | Exploration defaults; `agent` command list                   |
| `scripts/agent.mjs`                                  | Run card, instructions, review-brief `--out`, stats          |
| `scripts/agent.test.mjs`                             | Tests for card, instructions, stats thresholds               |
| `openspec/specs/agent-context/spec.md`               | Sync on archive                                              |

## Composition

Extend `scripts/agent.mjs` (parseArgs / preflight / reviewBrief / stats / instructions). No new top-level subsystem. Tests via existing `run()` helpers in `agent.test.mjs`.

## Test plan

Public API: `pnpm agent stats`, `instructions`, preflight JSON card fields, `review-brief --out`. Tmp fixtures. No e2e/UI.

## Security

N/A — no app security surface; cli.json only stricter denies.
