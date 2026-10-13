# Proposal

## Problem

Agent quality gates are strong on verify/Stryker/OpenSpec, but still miss: indexed-access/warning-strict TypeScript, dead-code and layer-boundary tooling, a lessons journal, and an explicit rule that exploratory/MCP bugs become Playwright e2e. Visual regression and book-core architecture are deferred but undocumented.

## Why now

Colleague agent-setup recommendations overlap current gaps; tightening static gates and process docs is cheapest before book-editor surface grows. Dependency bumps stay small (knip, dependency-cruiser).

## Scope in

- `noUncheckedIndexedAccess` + ESLint `--max-warnings=0`
- knip + dependency-cruiser in `verify:fast` and CI checks (lib/pure-photo purity rules)
- `docs/lessons.md` + OpenSpec mandates to read/update it; MCP/explore → e2e lock-in
- `docs/future-architecture.md` (book core / shared render deferred)
- GitHub issue for visual regression e2e (deferred until spreads)

## Scope out

- Screenshot Playwright + Docker image implementation
- `src/core` extraction, book Zod model, print/shared renderer
- Claude stop-hooks; renaming `verify` → `check`
- Directory picker, IndexedDB handles, DPI/PDF/R2

## Success criteria

- `pnpm verify:fast` fails on knip unused exports, forbidden imports, indexed-access errors, or ESLint warnings
- CI checks run `pnpm deps` and `pnpm knip`
- `docs/lessons.md` exists; `openspec/config.yaml` and AGENTS.md require lessons read/update and MCP→e2e lock-in
- Visual regression and book-core deferred via `docs/future-architecture.md` + GitHub issue only

## Risks

- **Security:** new dependency bumps (knip, dependency-cruiser) — run `audit:ci` and Security Review before archive
- knip false positives may need narrow allows; keep config minimal
- `noUncheckedIndexedAccess` may require small production/test fixes

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `agent-context`: lessons journal process; MCP→e2e lock-in; docs navigation
- `ci-gates`: knip + dependency-cruiser in checks / verify:fast

## Impact

TypeScript configs, ESLint script, package scripts, checks workflow, AGENTS/README, `openspec/config.yaml`, new `docs/` files, two new devDependencies.
