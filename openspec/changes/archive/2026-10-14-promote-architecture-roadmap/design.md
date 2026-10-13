# Design

## Context

See proposal.md — Why. Today `docs/future-architecture.md` is a short deferred note; the full architecture and roadmap drafts live under gitignored `.local_dev/`. Agents need durable copies under `docs/` plus navigation and an updated `agent-context` contract. No application code changes.

## Goals / Non-Goals

**Goals:**

- Make architecture + roadmap the durable agent SoT under `docs/`
- Keep AGENTS.md a thin navigation map (≤150 lines)
- Update `agent-context` so future agents must find both docs

**Non-Goals:**

- Implementing any roadmap checkbox (including `frame-budget-gates`)
- Changing LoAF budgets, headers, workers, or alwaysApply architecture rules
- Committing `.local_dev/`

## Decisions

1. **Copy, do not symlink** — Promote by copying file contents from `.local_dev/` at apply time (re-read disk). Symlinks would break for clones without that folder.
2. **Replace architecture doc wholesale** — The draft supersedes the short deferred note; keep the visual-regression section and issue `#8` (already present in the draft).
3. **Leave runtime perf gates untouched** — Architecture documents the 60 fps target; code/rules still use 200 ms LoAF until `frame-budget-gates`. Avoid a docs/code mismatch in this PR.
4. **Config context only mentions roadmap in Doc budget** — Do not duplicate roadmap checklists into `openspec/config.yaml` or alwaysApply rules.
5. **Spec delta on `agent-context`** — MODIFY "Future architecture notes"; ADD "Product roadmap" requiring `docs/roadmap.md` + AGENTS link.

## Touch-set

- `docs/future-architecture.md` (replace)
- `docs/roadmap.md` (add)
- `AGENTS.md` (Docs section)
- `openspec/config.yaml` (`context` Doc budget line)
- `openspec/changes/promote-architecture-roadmap/specs/agent-context/spec.md` (delta; synced on archive)

## Risks / Trade-offs

- [Source drift] → Re-read `.local_dev/*.md` immediately before copy; do not use chat memory.
- [Agents implement architecture early] → Roadmap + architecture both state: one OpenSpec change per checkbox; no drive-by implementation.
- [Doc-only verify noise] → Run `pnpm verify:fast`; mark e2e / Stryker / LHCI / audit / Security Review N/A in tasks.

## Migration Plan

Promote on a docs branch; merge to `main`. No rollback beyond git revert. After merge, next change is `frame-budget-gates` from the roadmap.
