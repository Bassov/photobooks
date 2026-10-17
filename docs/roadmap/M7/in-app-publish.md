# in-app-publish

Tag: feature
Milestone: M7
Title: publish button (Security Review)

## Scope

- [ ] Incremental upload by hash manifest from a worker; progress and retry
- **Perf:** scenario: edit with drag while an upload runs — zero LoAF.
- **Browser check:** change one spread, publish, only changed files upload, the live site updates; the editor stays smooth during upload.
- **UI ref:** `uikit#/feature/in-app-publish`
