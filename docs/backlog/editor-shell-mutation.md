# editor-shell-mutation

Tag: prep
Milestone: M2.1
Title: mutate `EditorShell.tsx` (issue #72 B)

## Scope

- [ ] Extend `EditorShell.test.tsx` (RTL) with a shared fake project-session snapshot store: open and save flows, save-indicator phases, the re-grant button, the lock banner
- [ ] Remove the `EditorShell.tsx` `temporary` entry
- **Done when:** `EditorShell.tsx` is mutated on both runs at 85+ with no NoCoverage, and its patch coverage is at least 85%.
- **Reason:** Editor chrome rewrites in M2.2/M2.5 make throwaway RTL/mutation work; E2E and patch coverage already cover the shell (pipeline-gates opt §3.1, owner 2026-10-20).
