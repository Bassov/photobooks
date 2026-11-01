## Proposal

Roadmap: `docs/roadmap/P1/rescan-cheap-verify.md` (scope / Done when / Perf SoT).

### Scope out

- Decode / thumb pipeline (`src/photo/*`), filmstrip files, `PERF_BUDGETS`.
- Identity key (path + size + mtime) and the always-walk rule stay as they are.

### Delta / Risk

- `ScannedEntry` gains an optional session-only `file` (FSA walk `getFile` snapshot, cloned from the worker without byte copies); priority verify retains it and falls back to `resolveFile` when absent. The manifest keeps writing metadata only. No spec delta: verify still reattaches via `getFile`, no body reads.
