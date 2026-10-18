# Proposal

## Problem

Library create/open, adopt of the in-memory book, switch-with-book-open, and restore-from-recents still live inside the large project session module, so that logic cannot be mutated at the M2.1 bar on its own.

## Why now

M2.1 requires the stateful session path back in mutation scope behind unit-level fakes. Autosave and book-lock controllers are already extracted; library activation is the next prep slice.

## Scope in

- Pure extract of create/open library, adopt in-memory book, switch library with a book open, and restore from recents into `libraryActivation.ts`
- Thin session delegation; public session API and library/recents UX unchanged
- Focused module unit tests including named PR #71 data-loss scenarios; existing `projectSession.test.ts` stays the integration suite (not moved)
- Reuse `autosaveController`, `bookLockController`, `fsa-permission-fakes`, and injected platform deps; no new dependencies; do not rework those controllers

## Scope out

- Changing library/open/adopt/recents product behaviour or UX
- Moving or rewriting `projectSession.test.ts` or library/recents/permissions e2e specs
- UI chrome, CI gates, Playwright config, autosave/book-lock rework

## Success criteria

- New module mutation ≥85 with zero NoCoverage; patch coverage ≥85
- Named unit tests cover PR #71 data-loss scenarios (switch never writes previous book into the new library; New library keeps unsaved edits; picker cancel and permission denied leave state unchanged)
- Existing library/recents/permissions e2e and project-session integration suites pass unchanged

## Risks

- Extract drift could drop an early return or reorder flush/release/bind (autosave extract review found a dropped guard) — mitigated by verbatim move + adversarial unit tests + unchanged integration/e2e
- Security: File System Access picker and permission prompts stay behind the same session entry points; no new handles, blob URLs, or permission prompts; behaviour unchanged
