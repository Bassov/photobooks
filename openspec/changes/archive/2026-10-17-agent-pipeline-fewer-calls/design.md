# Design

## Context

See proposal.md. `/next-roadmap-item` still expands preflight, finish, and reviewer briefs into many shell/tool calls (issue #79). Pattern: [scripts/roadmap.mjs](scripts/roadmap.mjs). Docs/scripts only; `roadmap.mjs` out of scope.

## Goals / Non-Goals

**Goals:** One CLI call per stage (`preflight` / `finish` / `review-brief`); wire command + batching + MCP note; `agent-context` delta; tests with injectable exec.

**Non-Goals:** Call-count / rtk (`agent-pipeline-call-count-check`); closing #79; auto-commit in `finish`; new npm deps; `src/`; gate edits; #78; changing `roadmap.mjs`.

## Decisions

1. **Mirror roadmap CLI shape** — Zero-deps ESM; `parseArgs`/`run`/`main`; `--json`, `--quiet`, `--root`; `package.json` `"agent": "node scripts/agent.mjs"`. Short text on success.

2. **Inject `exec` for tests** — Default sync runner; tests pass `{code,stdout,stderr}` fakes. New harness only in `scripts/agent.test.mjs` (do not share with `roadmap.test.mjs`).

3. **`preflight` agent-env** — Command still says source `scripts/agent-env.sh` once. CLI only asserts `node` major matches `.nvmrc` and `pnpm` is on PATH (fail with a short hint to source the script). Then: clean tree; fetch + switch/pull `main`; skip-list from `gh pr list` + remote `feat|fix/*`; `roadmap next --skip`; `git switch -c feat|fix/<slug>`; `openspec new change` if missing; compact report (item + `{template,rules}` from `openspec instructions proposal --json`, touch-set = design path or TBD).

4. **`finish`** — `verify:fast:quiet`; refuse dirty tree; push `-q` ≤2 fails; `gh pr` create (requires `--title` + `--body-file`) or update if PR exists; CI watch silent then `--json name,bucket`; red → tailed `--log-failed`. Never `git commit`.

5. **`review-brief`** — `--change <slug>` (default: branch after `feat/`/`fix/`); print slug, change path, rules (from `--rules-json` or empty array + note), `git diff --stat`, touch-set diff from design.md table paths when parseable else stat + note.

6. **Command** — Steps 1–2 → `pnpm agent preflight`; step 6 → `pnpm agent finish` after agent commit; reviewers → `review-brief`. Batching: parallel reads; shell `&&`; one Write + validate per artifact stage.

7. **MCP** — AGENTS: pipeline happy path needs no project MCP (`gh`/`git`/`pnpm`/`openspec` via shell); disable unused Cursor MCP for this repo. No MCP packages in lockfile.

8. **Quiet** — `CI` or `--quiet`: strip ANSI from child output.

## Touch-set

| File                                                                      | Why                             |
| ------------------------------------------------------------------------- | ------------------------------- |
| `scripts/agent.mjs`                                                       | composite CLI                   |
| `scripts/agent.test.mjs`                                                  | fake-exec harness + cases       |
| `package.json`                                                            | `"agent"` script                |
| `.cursor/commands/next-roadmap-item.md`                                   | wire + batching                 |
| `AGENTS.md`                                                               | Commands + MCP (≤150 lines)     |
| `openspec/changes/agent-pipeline-fewer-calls/specs/agent-context/spec.md` | delta                           |
| `openspec/specs/agent-context/spec.md`                                    | sync at archive                 |
| `docs/roadmap/M2.1/agent-pipeline-fewer-calls.md`                         | tick scope                      |
| `docs/roadmap/M2.1/agent-pipeline-call-count-check.md`                    | scheduled follow-up             |
| `docs/roadmap.md`                                                         | via `roadmap add` / `done` only |

No gate-config / CI workflow / `src/` / `roadmap.mjs` edits.

## Composition

`agent.mjs` orchestrates existing tools; mandates stay in config + specs; AGENTS navigation only.

## Tests

Public API: `parseArgs`, `run` + fake `exec`. Cases: preflight happy JSON; dirty tree fail; finish push budget (2 fails then stop); finish refuses dirty; review-brief shape; `--quiet` strips ANSI in fixture output.

## Risks

- [create-PR needs body] → `--title`/`--body-file` or update-existing.
- [instructions before change] → create change in preflight when missing.

## Migration

One PR; archive syncs `agent-context`. Measurement in follow-up item.
