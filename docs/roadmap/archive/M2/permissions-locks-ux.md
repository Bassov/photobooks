# permissions-locks-ux

Tag: feature
Milestone: M2
Title: access and single writer

## Scope

- [x] Permission re-grant flow; Web Locks single writer with a clear "open in another tab" message
- **Perf:** chrome status/banner updates only; existing save/autosave gesture gates stay green.
- **Browser check:** after a browser restart, access is re-granted in one step; a second tab is blocked from editing.
- **UI ref:** `uikit#/feature/permissions-locks-ux`
