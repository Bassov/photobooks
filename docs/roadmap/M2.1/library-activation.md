# library-activation

Tag: prep
Milestone: M2.1
Title: extract library open / new / switch from `projectSession.ts`
Status: done

## Scope

- [x] `src/editor/session/libraryActivation.ts`: create and open a library, adopt the in-memory book, switch library with a book open, and restore from recents
- [x] Adversarial scenario tests: switching to another library never writes the previous book into it, New library keeps unsaved edits, and picker cancel and permission denied leave state unchanged
- [x] If the move and tests go over budget, use the growth rule (recents / restore as the next checkbox)
- **Done when:** the new module is mutated at 85+ with no NoCoverage, and the PR #71 data-loss scenarios are covered by named unit tests.

## Done note

Extracted create/open/adopt/switch/recents-restore into libraryActivation.ts; mutation 92.59, 0 NoCoverage; growth not needed
