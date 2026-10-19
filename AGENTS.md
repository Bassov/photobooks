# Photobooks — agent map

Navigation only. Per-change mandates: `openspec/config.yaml`. Behavior: `openspec/specs/`.

## Stack

Vite + React 19 + TypeScript. Node 22, pnpm 10. English in repo; Russian only in chat / `.local_dev/` (gitignored).

## Module map

| Area                 | Code                                   | Spec                                             |
| -------------------- | -------------------------------------- | ------------------------------------------------ |
| Book document        | `src/core/`                            | `openspec/specs/book-core/`                      |
| Layout geometry      | `src/core/` (templates/ops/resolve)    | `openspec/specs/layout-geometry/`                |
| Library storage      | `src/project/`                         | `openspec/specs/library-storage/`                |
| Session state        | `src/project/session/`                 | `openspec/specs/session-state/`                  |
| Asset source / cache | `src/assets/`                          | `openspec/specs/asset-source/`, `derived-cache/` |
| Editor shell         | `src/editor/` (incl. `projectSession`) | `openspec/specs/editor-shell/`                   |
| Spread painter       | `src/render/`                          | `openspec/specs/spread-view/`                    |
| Photo / asset pool   | `src/photo/`                           | `openspec/specs/photo-card/`                     |
| Perf / 60 fps        | `src/perf/`                            | `openspec/specs/frame-budget/`                   |
| Shared helpers       | `src/lib/`                             | —                                                |
| Preview hosting      | `wrangler.jsonc`, deploy scripts       | `openspec/specs/preview-hosting/`                |
| CI quality gates     | `.github/`, `codecov.yml`              | `openspec/specs/ci-gates/`                       |
| Agent pipeline       | `.cursor/`, `scripts/agent.mjs`        | `openspec/specs/agent-context/`                  |
| UI kit reference     | `uikit/` (served at `/uikit/`)         | — (prep; `UI ref: uikit#/feature/<slug>`)        |

New capabilities: add `src/<capability>/` and a matching `openspec/specs/<capability>/`.

## Commands (reference)

| Command                       | Use                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `/next-roadmap-item`          | one roadmap item end to end (unattended)                                      |
| `pnpm roadmap`                | roadmap CLI: `next` / `show` / `add` / `done` / `check`                       |
| `pnpm agent`                  | `preflight` (run card) / `finish` / `review-brief` / `instructions` / `stats` |
| `pnpm check`                  | deterministic gates (fail-all, compact OK lines)                              |
| `pnpm verify`                 | `pnpm check` + Playwright                                                     |
| `pnpm test:e2e:changed:quiet` | changed e2e specs only (burn-in targets), quiet                               |
| `pnpm perf`                   | Playwright frame-budget scenarios (hard frame pacing)                         |
| `pnpm stryker:diff`           | mutations vs `origin/main`                                                    |
| `pnpm test:lhci`              | Lighthouse budgets                                                            |
| `pnpm audit:ci`               | high-severity **production** dependency audit                                 |
| `pnpm uikit:*`                | kit typecheck / build / qa:quick / solo dev (`uikit/` at `/uikit/`)           |

## Skills (on demand)

| Skill                 | When                               |
| --------------------- | ---------------------------------- |
| OpenSpec `openspec-*` | propose / apply / archive / sync   |
| `react-composition`   | component APIs, composition        |
| `react-perf-spa`      | SPA bundle / re-render / workers   |
| `ui-review`           | UI a11y / layout smoke / anti-slop |
| `write-tests`         | unit / e2e / PBT authorship        |
| `roadmap`             | pick / grow / close roadmap items  |

## Security surface

File System Access, workers/`postMessage`, blob/object URLs, CSP/headers, dependency bumps, export. CI: `audit:ci` + CodeQL + dependency-review + gitleaks (see `ci-gates`). High-risk changes: Security Review before archive (see OpenSpec config).

Repo secrets / settings (operators): set `CODECOV_TOKEN` for Codecov PR comments; enable GitHub Secret scanning and Push protection.

## Docs

- Lessons journal: `docs/lessons/` (read all entries in one call; new files `docs/lessons/<YYYY-MM-DD>-<slug>.md`; index `docs/lessons.md` is not updated per entry — mandates in OpenSpec config).
- Target architecture (incl. 60 fps model): `docs/future-architecture.md`.
- Execution plan (one OpenSpec change per item): index `docs/roadmap.md` + one file per item in `docs/roadmap/`; use `pnpm roadmap` (skill `roadmap`), never read it whole or hand-edit it. Process: `docs/roadmap/RULES.md`.

## Toolchain / Cursor Cloud

Headless `cursor-agent -p` uses project `.cursor/cli.json` (allow/deny). Gate-file edits must be strictly stricter and listed in the design touch-set. The launcher (not the agent) must `source scripts/agent-env.sh` and start the agent with `--trust --force` so allowlisted tools are not stalled by Auto-review; `--force` still respects deny.

Exploration defaults (unattended `-p`): scoped grep ≤30 hits; offset/limit reads for files >400 lines; no re-read of an unchanged file; no TodoWrite; Task reviewers get skill set + `pnpm agent review-brief --out <file>` path only. Prefer the preflight run card / `pnpm agent instructions` over denied raw OpenSpec/agent reads. `pnpm agent stats <path>` prints per-round tokens (exit 1 if peak context >300K or first-round input >400K).

Agent shells: `source scripts/agent-env.sh` once so asdf shims + Node from `.nvmrc` are on PATH (does not write `.tool-versions`). Run `pnpm check` until it prints only OK lines; Lefthook pre-push and CI `checks` call the same entry. Playwright stays separate (`test:e2e:changed:quiet` locally; full e2e in CI). Local `--repeat-each=3` only if a flake already failed then passed locally. `pnpm agent finish` opens/updates the PR and stops (no CI watch).

Pipeline MCP: the unattended `/next-roadmap-item` happy path needs **no** project MCP (use shell `git` / `gh` / `pnpm` / `openspec`). Disable unused Cursor MCP servers for this repo so their tool schemas are not re-sent on every model call. Optional local shell-output proxies (e.g. rtk) are machine add-ons; CI and other agents do not have them, so the quiet scripts stay the baseline.

`pnpm install` exits non-zero while `core.hooksPath` points at Cursor agent hooks, because `prepare` runs `lefthook install`. Install with `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm rebuild esbuild workerd lefthook`. Dev server: `pnpm exec vite --host 0.0.0.0 --port 5173` (an extra `--` makes Vite ignore `--host`).

## Doc budget

- One `AGENTS.md` (≤150 lines), no workflow checklists here.
- ≤5 alwaysApply Cursor rules; short product invariants only.
- Skills for repeatable workflows; specs for behavior.
- Never weaken quality gates for any reason — see `openspec/config.yaml` quality bar and `docs/lessons/`.
