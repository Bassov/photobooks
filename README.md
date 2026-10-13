# Photobooks

Local-first photobook editor. Vite + React + TypeScript with OpenSpec, verify loop, and CI.

## Requirements

- Node.js 22 (see `.tool-versions`)
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

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `pnpm dev`            | Vite dev server                          |
| `pnpm typecheck`      | TypeScript project build check           |
| `pnpm build`          | Typecheck and production build           |
| `pnpm preview`        | Preview production build                 |
| `pnpm deploy`         | Build + deploy to Cloudflare Workers     |
| `pnpm deploy:preview` | Build + upload a Workers preview version |
| `pnpm lint`           | ESLint (strict-type-checked)             |
| `pnpm format`         | Prettier write                           |
| `pnpm test`           | Vitest unit + PBT                        |
| `pnpm test:e2e`       | Playwright                               |
| `pnpm test:lhci`      | Build + Lighthouse CI (`budget.json`)    |
| `pnpm stryker`        | Full mutation testing                    |
| `pnpm stryker:diff`   | Mutations since `origin/main`            |
| `pnpm verify:fast`    | typecheck + lint + vitest                |
| `pnpm verify`         | verify:fast + Playwright                 |
| `pnpm bench`          | Vitest benchmarks                        |

Lefthook: pre-commit lint/format on staged files; pre-push runs `pnpm verify`.

## OpenSpec

- Config: `openspec/config.yaml` (quality bar, short proposal limits, mandatory verify + review gates)
- Cursor skills/commands under `.cursor/`
- Review subagents: `.cursor/agents/openspec-proposal-reviewer.md`, `.cursor/agents/openspec-implementation-reviewer.md`

Workflow: propose → proposal-reviewer → design/tasks → apply → verify gates → implementation-reviewer → archive.

## CI

GitHub Actions: `checks`, `integration`, `lighthouse` (PR), `stryker-diff` (PR), `stryker-full` (nightly on `main`).

## Hosting (Cloudflare Workers Free)

Assets-only Worker serves `dist/` as a SPA (`wrangler.jsonc`). Static asset requests are free/unlimited on the Workers Free plan; keep the Worker assets-only (no `main` script) so preview traffic does not consume the free daily Workers request quota.

| Workers Builds setting | Value                                |
| ---------------------- | ------------------------------------ |
| Production branch      | `main`                               |
| Build command          | `pnpm install && pnpm build`         |
| Deploy command         | `pnpm exec wrangler deploy`          |
| Preview command        | `pnpm exec wrangler versions upload` |
| Output / assets        | `./dist` (from Wrangler config)      |

Production URL (Workers Free, assets-only): https://photobooks.photobooks-bassov.workers.dev

Connect once in the Cloudflare dashboard (Workers Free): [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → Worker `photobooks` → Settings → Builds → connect GitHub repo `Bassov/photobooks` (install the Cloudflare Workers & Pages GitHub App if prompted), enable non-production branch / preview builds. Cloudflare posts preview URLs on pull requests after a successful preview build — no custom comment bot.

Local deploy (requires `wrangler login` or API token):

```bash
pnpm deploy
```
