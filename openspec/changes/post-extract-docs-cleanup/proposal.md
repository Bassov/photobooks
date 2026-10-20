## Proposal

Roadmap: `docs/roadmap/M2.1/post-extract-docs-cleanup.md`.

### Scope out

- No product/`src/` behavior changes
- No further prune of `openspec/changes/archive/` (already `.cursorignore`’d)

### Delta / Risk

- Requires `@albasov/ts-agent-rig@v0.2.2` (roadmap `archive` = retire); host must delete legacy `docs/roadmap/archive/` or `pnpm roadmap check` fails
