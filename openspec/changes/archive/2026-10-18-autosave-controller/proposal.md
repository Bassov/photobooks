# Proposal

## Problem

Autosave debounce, gesture gating, save-phase transitions, and pending-hash wait still live inside the large project session module, so that logic cannot be mutated at the M2.1 bar on its own.

## Why now

M2.1 requires the stateful session path back in mutation scope behind unit-level fakes. This extract is the next prep step after injected platform deps and FSA permission fakes.

## Scope in

- Pure extract of autosave scheduling into a focused controller module
- Thin session delegation; public session API and autosave UX unchanged
- Focused controller unit tests; existing project-session integration suite stays in place (not moved)
- Reuse existing FSA permission fakes and injected platform deps; no new dependencies

## Scope out

- Autosave timing, indicator UX, or durable save-path semantics
- Moving or rewriting the project-session integration suite or autosave e2e specs
- UI chrome, CI gates, Playwright config

## Success criteria

- New controller module mutation ≥85 with zero NoCoverage; patch coverage ≥85
- Existing project-session and autosave e2e suites pass unchanged
- Perf unchanged: continuous drag while autosave would fire still shows zero LoAF

## Risks

- Extract drift could reorder debounce / gesture / pending-hash handling — mitigated by controller tests plus unchanged integration and e2e suites
- Security: File System Access and save/permission failure paths stay behind the same session save entry; no new handles, blob URLs, or permission prompts; behaviour unchanged
