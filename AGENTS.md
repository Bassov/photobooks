# Photobooks — agent map

Navigation only. Per-change mandates: `openspec/config.yaml`. Behavior: `openspec/specs/`.

## Stack

Vite + React 19 + TypeScript. Node 22, pnpm 10. English in repo; Russian only in chat / `.local_dev/` (gitignored).

## Module map

| Area              | Code                             | Spec                                  |
| ----------------- | -------------------------------- | ------------------------------------- |
| Photo open / card | `src/photo/`                     | `openspec/specs/photo-card/`          |
| Perf / LoAF       | `src/perf/`                      | (covered by photo-card / quality bar) |
| Shared helpers    | `src/lib/`                       | —                                     |
| Preview hosting   | `wrangler.jsonc`, deploy scripts | `openspec/specs/preview-hosting/`     |
| Agent pipeline    | `.cursor/`, `AGENTS.md`          | `openspec/specs/agent-context/`       |

New capabilities: add `src/<capability>/` and a matching `openspec/specs/<capability>/`.

## Commands (reference)

| Command             | Use                                           |
| ------------------- | --------------------------------------------- |
| `pnpm verify:fast`  | typecheck + lint + vitest                     |
| `pnpm verify`       | verify:fast + Playwright                      |
| `pnpm stryker:diff` | mutations vs `origin/main`                    |
| `pnpm test:lhci`    | Lighthouse budgets                            |
| `pnpm audit:ci`     | high-severity **production** dependency audit |

## Skills (on demand)

| Skill                 | When                             |
| --------------------- | -------------------------------- |
| OpenSpec `openspec-*` | propose / apply / archive / sync |
| `react-composition`   | component APIs, composition      |
| `react-perf-spa`      | SPA bundle / re-render / workers |
| `ui-review`           | UI a11y / anti-slop audit        |
| `write-tests`         | unit / e2e / PBT authorship      |

## Security surface

File System Access, workers/`postMessage`, blob/object URLs, CSP/headers, dependency bumps, export. CI: `audit:ci` + CodeQL. High-risk changes: Security Review before archive (see OpenSpec config).

## Doc budget

- One `AGENTS.md` (≤150 lines), no workflow checklists here.
- ≤5 alwaysApply Cursor rules; short product invariants only.
- Skills for repeatable workflows; specs for behavior.
