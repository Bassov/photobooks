# stryker-diff-line-scope

Tag: prep
Milestone: M2.1
Title: stryker-diff scores only changed line ranges (ts-agent-rig)

## Scope

- [x] In `@albasov/ts-agent-rig`, derive changed line ranges per file from merge-base hunks and mutate/score only those ranges (`path:start-end` or equivalent filter)
- [x] NoCoverage and the 85% break apply only to mutants on scored ranges; empty scored ranges skip without failure; PR summary lists ranges
- [x] Photobooks pin bump after rig release; tests cover comment-only / no-mutable-line edits on legacy below-85% files
- **Done when:** comment-only or non-mutable touches on legacy files no longer fail the gate; changed-line NoCoverage or <85% still fail; thresholds in `quality/gates.json` unchanged
- **Size:** ~500 lines (mostly in ts-agent-rig)
- **Source:** closed PR #132; redo after harness extract

Status: done
Done note: ts-agent-rig v0.2.3 line-scoped mutate/score; photobooks pin + docs (file→line wording).
