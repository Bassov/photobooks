# Proposal

## Problem

Unit tests cannot drive File System Access permission and picker outcomes: no shared scriptable fake for grant / prompt / deny or picker cancel. Ad-hoc stubs in FSA adapter suites drift, and deny / prompt-then-deny / cancel / re-grant never run in Vitest without a browser.

## Why now

M2.1 mutation re-includes need this seam before `project-session-deps` and session/editor re-includes. Shipping the fake alone unblocks those items without mixing injection or product work into this PR.

## Scope in

- Shared unit-level FSA permission/picker fake under `src/project/fsa/`
- Contract tests for that fake
- Existing FSA adapter unit tests reuse the fake (replace local permission stubs)
- Vitest coverage of deny, prompt-then-deny, cancel, and re-grant for the FSA library adapter (no browser)

## Scope out

- `project-session-deps` dependency injection
- e2e FSA stubs (`fsa-permission-e2e`)
- `src/editor/**`, Pasteboard, scripts, CI, package.json dependencies
- Product FSA behavior / spec requirement changes (`skip_specs: true`)

## Success criteria

- Vitest (no browser) runs deny, prompt-then-deny, cancel, and re-grant against the FSA library adapter using the shared fake
- Fake has its own contract tests; FSA adapter suites reuse it instead of local stubs
- Roadmap item Done-when satisfied; no gate weakening

## Risks

- Fake sequences may diverge from Chromium FSA — mitigate with contract cases locked to the Done-when paths
- **Security:** helpers are test-only and must not be imported by production; no change to real permission prompts or trusted-path handling
