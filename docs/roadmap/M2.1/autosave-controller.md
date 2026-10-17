# autosave-controller

Tag: prep
Milestone: M2.1
Title: extract autosave from `projectSession.ts`

## Scope

- [ ] `src/editor/session/autosaveController.ts`: debounce, the gesture gate, save phases and pending-hash wait. `projectSession.ts` delegates to it
- [ ] Focused controller tests. `projectSession.test.ts` stays the integration suite and is not moved (moved lines count toward the size limit)
- **Perf:** behaviour unchanged. Gate: continuous drag while autosave fires — zero LoAF.
- **Done when:** the new module is mutated at 85+ with no NoCoverage, and the existing `projectSession` and autosave e2e suites pass unchanged.
