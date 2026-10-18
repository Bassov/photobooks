# agent-cost-cuts

Tag: prep
Milestone: M2.1
Title: Cut agent input/output tokens and keep a session under 300K context

## Scope

- [ ] One OpenSpec review instead of separate proposal and design reviews: a single reviewer runs after proposal + design + tasks are all written; the implementation review stays. The reviewer subagent gets only the review skill set and the brief file path (`pnpm agent review-brief --out <file>`), not the full agent preamble; at most one delta re-review per stage; docs-only changes skip design review. Update `openspec/config.yaml`, `.cursor/agents/*` and `next-roadmap-item.md` accordingly
- [ ] Compact run card: `pnpm agent preflight` prints, per artifact, only its template and rules plus a ≤10-line apply/archive procedure; `pnpm agent instructions <artifact>` for one artifact on demand. Deny raw reads in `.cursor/cli.json` of `openspec instructions`, `openspec/config.yaml`, `.cursor/skills/openspec-*`, `.cursor/agents/*` (the card replaces them)
- [ ] Output limits for exploration: AGENTS.md rule + defaults — scoped grep with ≤30 results, offset/limit reads for files >400 lines, no re-read of an unchanged file; no TodoWrite in unattended `-p` runs; Task call shape in the run card
- [ ] `pnpm agent stats <store.db|transcript>`: per round input, output, cache read, model calls, peak context; exit 1 when peak context >300K tokens or first-round input >400K. The runner calls it after each round (owner-side driver logs it)
- **Done when:** a scratch `/next-roadmap-item` run on a small real item shows one OpenSpec review call, no raw reads of the denied files, and `pnpm agent stats` prints the numbers and fails on a fixture over 300K; input tokens of that run are reported against the pre-change average (~230K per first round).
- **Size:** ~800 changed lines
- **Source:** owner 2026-10-18 cost analysis (cuts 3–6, 8; plan/apply split rejected)
