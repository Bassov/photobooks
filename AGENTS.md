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
| Agent pipeline       | `.cursor/`, `AGENTS.md`                | `openspec/specs/agent-context/`                  |

New capabilities: add `src/<capability>/` and a matching `openspec/specs/<capability>/`.

## Commands (reference)

| Command              | Use                                                      |
| -------------------- | -------------------------------------------------------- |
| `/next-roadmap-item` | one roadmap item end to end (unattended)                 |
| `pnpm roadmap`       | roadmap CLI: `next` / `show` / `add` / `done` / `check`  |
| `pnpm verify:fast`   | typecheck + lint + deps + knip + mutation scope + vitest |
| `pnpm verify`        | verify:fast + Playwright                                 |
| `pnpm perf`          | Playwright frame-budget scenarios (hard frame pacing)    |
| `pnpm deps`          | dependency-cruiser layer rules                           |
| `pnpm knip`          | unused exports / deps                                    |
| `pnpm stryker:diff`  | mutations vs `origin/main`                               |
| `pnpm test:lhci`     | Lighthouse budgets                                       |
| `pnpm audit:ci`      | high-severity **production** dependency audit            |

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

- Lessons journal: `docs/lessons.md` (read before apply; append when a finding repeats — mandates in OpenSpec config).
- Target architecture (incl. 60 fps model): `docs/future-architecture.md`.
- Execution plan (one OpenSpec change per item): index `docs/roadmap.md` + one file per item in `docs/roadmap/`; use `pnpm roadmap` (skill `roadmap`), never read it whole or hand-edit it. Process: `docs/roadmap/RULES.md`.

## Cursor Cloud

`pnpm install` exits non-zero while `core.hooksPath` points at Cursor agent hooks, because `prepare` runs `lefthook install`. Install with `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm rebuild esbuild workerd lefthook`. Dev server: `pnpm exec vite --host 0.0.0.0 --port 5173` (an extra `--` makes Vite ignore `--host`).

## Doc budget

- One `AGENTS.md` (≤150 lines), no workflow checklists here.
- ≤5 alwaysApply Cursor rules; short product invariants only.
- Skills for repeatable workflows; specs for behavior.
- Never weaken quality gates for any reason — see `openspec/config.yaml` quality bar and `docs/lessons.md`.
