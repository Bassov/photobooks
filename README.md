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

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Vite dev server                       |
| `pnpm typecheck`    | TypeScript project build check        |
| `pnpm build`        | Typecheck and production build        |
| `pnpm preview`      | Preview production build              |
| `pnpm lint`         | ESLint (strict-type-checked)          |
| `pnpm format`       | Prettier write                        |
| `pnpm test`         | Vitest unit + PBT                     |
| `pnpm test:e2e`     | Playwright                            |
| `pnpm test:lhci`    | Build + Lighthouse CI (`budget.json`) |
| `pnpm stryker`      | Full mutation testing                 |
| `pnpm stryker:diff` | Mutations since `origin/main`         |
| `pnpm verify:fast`  | typecheck + lint + vitest             |
| `pnpm verify`       | verify:fast + Playwright              |
| `pnpm bench`        | Vitest benchmarks                     |

Lefthook: pre-commit lint/format on staged files; pre-push runs `pnpm verify`.

## OpenSpec

- Config: `openspec/config.yaml` (quality bar, short proposal limits, mandatory verify + review gates)
- Cursor skills/commands under `.cursor/`
- Review subagents: `.cursor/agents/openspec-proposal-reviewer.md`, `.cursor/agents/openspec-implementation-reviewer.md`

Workflow: propose → proposal-reviewer → design/tasks → apply → verify gates → implementation-reviewer → archive.

## CI

GitHub Actions: `checks`, `integration`, `lighthouse` (PR), `stryker-diff` (PR), `stryker-full` (nightly on `main`).
