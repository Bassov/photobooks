# Photobooks

Local-first photobook editor. Phase 1 scaffold: Vite + React + TypeScript.

## Requirements

- Node.js 22 (see `.tool-versions`)
- pnpm 10 (`corepack enable`)

## Setup

```bash
pnpm install
pnpm dev
```

## Scripts

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | Start the Vite dev server                 |
| `pnpm typecheck` | TypeScript project build check (`tsc -b`) |
| `pnpm build`     | Typecheck and production build            |
| `pnpm preview`   | Preview the production build              |
| `pnpm lint`      | Run ESLint                                |
| `pnpm format`    | Format with Prettier                      |

## Stack (phase 1)

- Vite + React + TypeScript (`strict`, `exactOptionalPropertyTypes`)
- ESLint (`typescript-eslint`) + Prettier

OpenSpec, CI, and the first photo-card feature arrive in later phases.
