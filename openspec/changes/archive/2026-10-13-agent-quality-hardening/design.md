# Design

## Context

See proposal.md — Why. Today: strict TS + exactOptionalPropertyTypes, ESLint strictTypeChecked, `verify`/`verify:fast`, CI checks without knip/depcruise. No `docs/`. Agent mandates live only in `openspec/config.yaml`. Security surface includes dependency bumps.

## Goals / Non-Goals

**Goals:** Tighten static gates (indexed access, zero ESLint warnings, knip, depcruise); wire lessons + MCP→e2e into OpenSpec; defer book-core and visual regression via docs + GitHub issue.

**Non-Goals:** Implement screenshots, `src/core`, Claude stop-hooks, rename `verify`.

## Decisions

1. **verify:fast includes deps+knip** — same local/CI story for agents; both tools are typically seconds. Alternatives: CI-only (rejected — agents skip) or only full `verify` (rejected — loops would skip until e2e).

2. **depcruise without empty `src/core`** — enforce `src/lib` purity and pure photo helpers (`aspectRatio`, `formatBytes`, `mime`, `normalizeOrientation`, `jpegSof`, `exifSchema`) no React. Add `core-is-pure` later when `src/core` exists (noted in future-architecture).

3. **knip config** — Vite entry `src/main.tsx`, worker entry, scripts; ignore test/e2e/playwright as needed. Prefer fixing real dead code over broad ignores.

4. **lessons wiring** — mandates in `openspec/config.yaml` apply guidance + quality bar; AGENTS.md one-line links only. No alwaysApply Cursor rule (doc budget).

5. **MCP→e2e lock-in** — `openspec/config.yaml` quality bar and apply guidance MUST state that bugs found via exploratory/MCP browser sessions are locked in with a Playwright test under `e2e/` before apply is complete.

6. **GitHub issue for visual regression** — create during apply; link from `docs/future-architecture.md`.

## Touch-set

- `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.e2e.json`
- `package.json` (scripts + knip/dependency-cruiser), lockfile
- `.dependency-cruiser.cjs`, knip config (`knip.json` or package field)
- `.github/workflows/checks.yml`
- `openspec/config.yaml`
- `docs/lessons.md`, `docs/future-architecture.md`
- `AGENTS.md`, `README.md`
- Existing `src/` / unit / `e2e/` call sites that fail after indexed-access or `--max-warnings=0` only (no new modules)

## Composition / boundaries

No new runtime modules. Tooling configs only. Pure helpers remain DOM-free; workers unchanged.

## Security

New devDependencies: knip, dependency-cruiser. Run `pnpm audit:ci`. Tag change security-surface; Security Review before archive. Prefer pinned versions via lockfile; no runtime supply-chain to the SPA bundle.

## Risks / Trade-offs

- [knip noise] → Minimal entry/ignore config; fix real unused code first
- [indexed-access churn] → Fix only call sites that fail typecheck
- [verify:fast slower] → Acceptable; deps+knip stay out of hot test:watch path

## Migration

Land on a branch; agents pick up new scripts via AGENTS/README. No data migration.
