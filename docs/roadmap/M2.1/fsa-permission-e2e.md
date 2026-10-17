# fsa-permission-e2e

Tag: prep
Milestone: M2.1
Title: e2e through the real permission code (issue #72 I)

## Scope

- [ ] `e2e/fixtures/fsAccess.ts` (`page.addInitScript`): stub `showDirectoryPicker`, `queryPermission` and `requestPermission` with `granted` / `prompt` / `denied`, and picker cancel (`AbortError`)
- [ ] Specs on the stub instead of only `attachMemoryLibraryForTests`: denied write, prompt then deny, cancel picker, reopen without permission, open another library with a book that has content, New library with unsaved edits. The `@preview` project uses the stub, so library scenarios stop being "not automated"
- includes: permission denied during open, hardening the denied path (from main's `recents-home-quality`)
- **Done when:** e2e and `preview-qa` for library open / new / re-grant run through the real permission code paths, and the PR #71 data bugs would fail them.
