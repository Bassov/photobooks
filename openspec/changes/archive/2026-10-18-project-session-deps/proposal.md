# Proposal

## Problem

`projectSession.ts` still reaches browser globals for the directory picker, handle permission APIs, and timers. Partial `configureProjectSession` injection is incomplete, so default FSA branches and lock/timer paths cannot be driven purely through deps in Vitest, and mutation re-includes stay blocked.

## Why now

M2.1 Phase 4: `fsa-permission-fakes` shipped the shared fake. This item injects platform deps only so later extracts (`autosave-controller`, `book-lock-controller`, `library-activation`) and `project-session-mutation` can mutate real seams without a browser.

## Scope in

- Expand session deps to `{ storage, sessionState, picker, permissions, clock / timers }` (browser defaults at the composition root)
- No orchestration / product logic moves
- Unit tests for default FSA branches (picker cancel, permission prompt / denied, re-grant) via `fsa-permission-fakes`, `memorySessionState`, and fake timers
- Keep `projectSession.ts` as a `temporary` mutation exclusion until `project-session-mutation`; new extracted platform-default module(s) mutate at 85 with 0 NoCoverage

## Scope out

- Extracting autosave / book-lock / library-activation controllers (later items)
- Changing `quality` / Stryker exclusions or gate thresholds
- Pasteboard, agent scripts, CI workflows, package.json dependencies
- Spec / SHALL text changes (`skip_specs: true`)

## Success criteria

- Permission, picker, and lock paths of `projectSession.ts` run in Vitest with no browser
- Patch coverage on `projectSession.ts` ≥ 85% (unit + e2e merged; Codecov)
- New production modules in this change: mutation score ≥ 85, 0 NoCoverage
- Roadmap Done-when met; no gate weakening

## Risks

- Incomplete injection leaves a global fallback that tests never exercise — mitigate by routing all listed platform calls through deps and covering them in Vitest
- **Security:** File System Access picker and permission prompts remain the real trusted path in production; injection must not weaken grant checks or invent silent allow paths
