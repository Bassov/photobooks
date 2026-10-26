# Photobooks

Local-first photobook editor. Vite + React + TypeScript with OpenSpec, verify loop, and CI.

## Requirements

- Node.js 22 (`.nvmrc` pins major `22`; Cloudflare Workers Builds uses that / `NODE_VERSION`, not a fragile asdf patch pin)
- pnpm 10 (`corepack enable`)

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
# Prefer system deps (needs sudo):
#   pnpm exec playwright install-deps chromium
# Or without sudo (WSL): extract libs into .local_dev/ (gitignored):
#   pnpm playwright:libs
pnpm dev
```

`pnpm test:e2e` / `pnpm verify` auto-load `.local_dev/playwright-libs` via `scripts/with-playwright-env.mjs` when present.

## Scripts

| Command                  | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `pnpm dev`               | Vite dev server                                                               |
| `pnpm typecheck`         | TypeScript project build check                                                |
| `pnpm build`             | Typecheck and production build                                                |
| `pnpm preview`           | Preview production build                                                      |
| `pnpm deploy`            | Build + deploy to Cloudflare Workers                                          |
| `pnpm deploy:preview`    | Build + upload a Workers preview version                                      |
| `pnpm lint`              | ESLint (strict-type-checked, max-warnings=0)                                  |
| `pnpm format`            | Prettier write                                                                |
| `pnpm deps`              | dependency-cruiser layer rules                                                |
| `pnpm knip`              | Unused exports / dependencies                                                 |
| `pnpm test`              | Vitest unit + PBT                                                             |
| `pnpm test:e2e`          | Playwright                                                                    |
| `pnpm test:lhci`         | Build + Lighthouse CI (`budget.json`)                                         |
| `pnpm stryker`           | Full mutation testing                                                         |
| `pnpm stryker:diff`      | Mutations on changed line ranges vs `origin/main` (B + CI; not in check:fast) |
| `pnpm check:fast`        | A: typecheck + lint + deps + knip + vitest + patch-coverage (no stryker)      |
| `pnpm check`             | alias of `check:fast`                                                         |
| `pnpm check:integrity`   | C1: openspec-budget / codecov-yml / roadmap                                   |
| `pnpm verify:fast`       | alias of `check:fast`                                                         |
| `pnpm verify:fast:quiet` | alias of `check:fast`                                                         |
| `pnpm verify`            | check:fast + Playwright                                                       |
| `pnpm test:e2e:quiet`    | Playwright with dot reporter                                                  |
| `pnpm bench`             | Vitest benchmarks                                                             |

Lefthook: pre-commit lint/format on staged files; pre-push is `ts-rig-ci hook-pre-push` (A+C1; no stryker). Hand-push always pays both; thin finish skip rules: `docs/agent-loop.md`. E2e / `stryker:diff` stay in CI / agent B.

## OpenSpec / agent loop

- Loop SoT: [`docs/agent-loop.md`](docs/agent-loop.md) (stages, A/B/C, stamp, thin finish)
- Artifact config: `openspec/config.yaml` (proposal/design/tasks shape + change-quality rules)
- Skills/commands/reviewers: SoT under `.cursor/` (`skills/`, `commands/`, `agents/`); Claude Code wrappers in `CLAUDE.md` + `.claude/` (harnesses: `docs/agent-loop.md`)
- Unattended: `/next-roadmap-item` (executes the loop SoT)

## CI

GitHub Actions: `checks` (typecheck, lint, format, coverage floors, audit, Codecov `unit` flag), `integration` (e2e + Codecov `e2e` flag; `codecov/patch` merges both), `lighthouse` (PR + `main`), `stryker-diff` (PR + mutation comment), `stryker-full` (nightly), `dependency-review`, `gitleaks`, CodeQL.

PR reports (comments): one CI report comment (coverage, Lighthouse, mutation sections; `ci-gates` spec). Install the [Codecov GitHub App](https://github.com/apps/codecov) when coverage-relevant files change.

Operators: add repository secret `CODECOV_TOKEN` (Codecov upload / PR comments). In GitHub → Settings → Code security, enable Secret scanning and Push protection.

## Hosting (Cloudflare Workers Free)

Assets-only Worker serves `dist/` as a SPA (`wrangler.jsonc`). Static asset requests are free/unlimited on the Workers Free plan; keep the Worker assets-only (no `main` script) so preview traffic does not consume the free daily Workers request quota.

| Workers Builds setting | Value                           |
| ---------------------- | ------------------------------- |
| Production branch      | `main`                          |
| Build command          | `pnpm install && pnpm build`    |
| Deploy command         | `pnpm exec wrangler deploy`     |
| Preview command        | `pnpm exec wrangler preview`    |
| Output / assets        | `./dist` (from Wrangler config) |

Production URL (Workers Free, assets-only): https://photobooks.photobooks-bassov.workers.dev

Connect once in the Cloudflare dashboard (Workers Free): [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → Worker `photobooks` → Settings → Builds → connect GitHub repo `Bassov/photobooks` (install the Cloudflare Workers & Pages GitHub App if prompted), enable non-production branch / preview builds. Cloudflare posts preview URLs on pull requests after a successful preview build — no custom comment bot.

Local deploy (requires `wrangler login` or API token):

```bash
pnpm deploy
```
