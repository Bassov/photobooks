# Photobooks — agent map

Navigation only. Per-change mandates: `openspec/config.yaml`. Behavior: `openspec/specs/`.

## Stack

Vite + React 19 + TypeScript. Product/toolchain conventions: `.cursor/rules/overview.mdc`.

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
| Agent pipeline       | `.cursor/`, `@albasov/ts-agent-rig`    | `openspec/config.yaml` (see `agent-context/`)    |
| UI kit reference     | `uikit/` (served at `/uikit/`)         | — (prep; `UI ref: uikit#/feature/<slug>`)        |

New capabilities: add `src/<capability>/` and a matching `openspec/specs/<capability>/`.

## Commands (reference)

| Command                       | Use                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `/next-roadmap-item`          | one roadmap item end to end (unattended)                                       |
| `pnpm roadmap`                | roadmap CLI: `next` / `show` / `add` / `done` / `check`                        |
| `pnpm agent`                  | `preflight` / `finish` / `review-brief` / `instructions` / `archive` / `stats` |
| `pnpm check`                  | deterministic gates incl. patch-coverage + line-scoped stryker:diff (pre-push) |
| `pnpm verify`                 | `pnpm check` + Playwright                                                      |
| `pnpm test:e2e:changed:quiet` | changed e2e specs only (burn-in targets), quiet                                |
| `pnpm perf`                   | Playwright frame-budget scenarios (hard frame pacing)                          |
| `pnpm stryker:diff`           | mutations on changed line ranges vs `origin/main`                              |
| `pnpm test:lhci`              | Lighthouse budgets                                                             |
| `pnpm audit:ci`               | high-severity **production** dependency audit                                  |
| `pnpm uikit:*`                | kit typecheck / build / qa:quick / solo dev (`uikit/` at `/uikit/`)            |

## Skills (on demand)

| Skill               | When                               |
| ------------------- | ---------------------------------- |
| `react-composition` | component APIs, composition        |
| `react-perf-spa`    | SPA bundle / re-render / workers   |
| `ui-review`         | UI a11y / layout smoke / anti-slop |
| `write-tests`       | unit / e2e / PBT authorship        |
| `roadmap`           | pick / grow / close roadmap items  |

## Security surface

File System Access, workers/`postMessage`, blob/object URLs, CSP/headers, dependency bumps, export. CI: `audit:ci` + CodeQL + dependency-review + gitleaks (see `ci-gates`). High-risk changes: Security Review before archive (see OpenSpec config).

Repo secrets / settings (operators): set `CODECOV_TOKEN` for Codecov PR comments; enable GitHub Secret scanning and Push protection.

## Docs

- Target architecture (incl. 60 fps model): `docs/future-architecture.md`.
- Execution plan: `docs/roadmap.md` + `docs/roadmap/` via `pnpm roadmap` (skill `roadmap`); process: `docs/roadmap/RULES.md`.

## Toolchain / Cursor Cloud

Headless `cursor-agent -p`: project `.cursor/cli.json`; launcher must `source scripts/agent-env.sh` and start with `--trust --force` (deny still honored). Prefer preflight run card / `pnpm agent instructions` over denied raw OpenSpec reads. `pnpm agent stats <path>` exits 1 if peak context >300K or first-round input >400K.

Agent shells: `source scripts/agent-env.sh` once (asdf + Node from `.nvmrc`; no `.tool-versions` write). Verify/flake policy: `.cursor/rules/testing.mdc`. Finish/PR / no CI watch: `.cursor/rules/git-finish.mdc`. Unattended pipeline: `/next-roadmap-item`.

Happy path needs no project MCP (`git` / `gh` / `pnpm`). OpenSpec lifecycle is native in `pnpm agent` (no `openspec` CLI). Disable unused Cursor MCP servers. Quiet scripts are the baseline (optional local proxies are machine add-ons).

`pnpm install` fails while `core.hooksPath` points at Cursor agent hooks (`prepare` → lefthook). Use `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm rebuild esbuild workerd lefthook`. Dev: `pnpm exec vite --host 0.0.0.0 --port 5173` (extra `--` makes Vite ignore `--host`).

## Doc budget

Sizes: `quality/gates.json` `agentRules.budgets` (pr-policy). Skills for workflows; specs for behavior. Quality bar: `openspec/config.yaml`.
