# Photobooks — agent map

Navigation only. Agent loop: `docs/agent-loop.md`. Artifact mandates: `openspec/config.yaml`. Behavior: `openspec/specs/`.

## Module map

| Area                 | Code                                   | Spec                                             |
| -------------------- | -------------------------------------- | ------------------------------------------------ |
| Book document        | `src/core/`                            | `openspec/specs/book-core/`                      |
| Layout geometry      | `src/core/` (templates/ops/resolve)    | `openspec/specs/layout-geometry/`                |
| Library storage      | `src/project/`                         | `openspec/specs/library-storage/`                |
| Session state        | `src/project/session/`                 | `openspec/specs/session-state/`                  |
| Asset source / cache | `src/assets/`                          | `openspec/specs/asset-source/`, `derived-cache/` |
| Editor shell         | `src/editor/` (incl. `projectSession`) | `editor-shell/`, `filmstrip/`, `pasteboard/`     |
| Spread painter       | `src/render/`                          | `openspec/specs/spread-view/`                    |
| Photo / asset pool   | `src/photo/`                           | `openspec/specs/photo-card/`                     |
| Perf / 60 fps        | `src/perf/`                            | `openspec/specs/frame-budget/`                   |
| Shared helpers       | `src/lib/`                             | —                                                |
| Preview hosting      | `wrangler.jsonc`, deploy scripts       | `openspec/specs/preview-hosting/`                |
| CI quality gates     | `.github/`, `ts-rig-*` (rig package)   | `quality/gates.json` (see `ci-gates/` pointer)   |
| Agent pipeline       | `.cursor/`, `.claude/`, `ts-agent-rig` | `docs/agent-loop.md` (see `agent-context/`)      |
| Design language      | `docs/design.md` + kit `/uikit/`       | — (`UI ref: uikit#/feature/<slug>`)              |

New capabilities: add `src/<capability>/` and a matching `openspec/specs/<capability>/`.

## Commands (reference)

| Command                       | Use                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `/next-roadmap-item`          | one roadmap item end to end (unattended)                                              |
| `pnpm roadmap`                | `next` / `show` / `add` / `done` / `check`                                            |
| `pnpm agent`                  | `preflight` / `finish` / `stamp-green` / `ci-wait` / `ci-brief` / `archive` / `stats` |
| `pnpm check:fast` / `check`   | A: unit gates + patch-coverage (no stryker); apply loops                              |
| `pnpm check:integrity`        | C1: budget / codecov-yml / roadmap (hand-push · CI; see agent-loop)                   |
| `pnpm verify`                 | `check:fast` + Playwright                                                             |
| `pnpm test:e2e:changed:quiet` | B (with `stryker:diff`): changed e2e, quiet                                           |
| `pnpm perf`                   | Playwright frame-budget scenarios                                                     |
| `pnpm stryker:diff`           | B + CI mutation (not in check:fast / pre-push)                                        |
| `pnpm test:lhci`              | Lighthouse budgets                                                                    |
| `pnpm audit:ci`               | high-severity **production** dependency audit                                         |
| `pnpm uikit:*`                | kit typecheck / build / qa:quick / solo `/uikit/`                                     |

## Security surface

File System Access, workers/`postMessage`, blob/object URLs, CSP/headers, dependency bumps, export. CI: `audit:ci` + CodeQL + dependency-review + gitleaks (see `ci-gates`). High-risk changes: Security Review before archive (see OpenSpec config).

Repo secrets / settings (operators): set `CODECOV_TOKEN` for Codecov PR comments; enable GitHub Secret scanning and Push protection.

## Docs

- Target architecture (incl. 60 fps model): `docs/future-architecture.md`.
- Stryker survivors (C-session): `docs/agent-loop.md` `## Stryker C-session`.
- Execution plan: `docs/roadmap.md` + `docs/roadmap/` via `pnpm roadmap` (skill `roadmap`); process: `docs/roadmap/RULES.md`.

## Toolchain / headless agents

Interactive shells: `source scripts/agent-env.sh` once (asdf + Node from `.nvmrc`); headless launcher preloads it — do not source. Unattended: `/next-roadmap-item`. Harness wiring (Cursor `.cursor/cli.json`; Claude Code `CLAUDE.md` + `.claude/`): `docs/agent-loop.md` `## Harnesses`. Prefer preflight run card / `pnpm agent instructions` over raw OpenSpec reads (denied headless). `pnpm agent stats <log>` exits 1 if peak context >300K or first-round input >400K.

Headless shell style (denied otherwise): change files with the Edit / Write tools, never `sed -i`, `cat > f <<EOF` or `python3 -` heredocs; `pnpm exec <bin>`, never `npx`; one plain command per Bash call (no `bash -c`); temp files under the worktree, not `/tmp`.

Before `pnpm agent finish` on `src/` changes: `pnpm stryker:diff` (~2–3 min); kill survivors with tests (max two runs, then C-session in `docs/agent-loop.md`).

Happy path needs no project MCP (`git` / `gh` / `pnpm`). OpenSpec is native in `pnpm agent`. Quiet scripts are the baseline.

`pnpm install` fails while `core.hooksPath` points at Cursor hooks (`prepare` → lefthook): `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm rebuild esbuild workerd lefthook`. Dev: `pnpm exec vite --host 0.0.0.0 --port 5173`.

## Doc budget

Sizes: `quality/gates.json` `agentRules.budgets`. Skills for workflows; specs for behavior. Loop: `docs/agent-loop.md`; artifacts: `openspec/config.yaml`.
