# in-app-publish

Tag: feature
Milestone: M7
Title: publish button (Security Review)

## Scope

- [ ] Incremental upload by hash manifest from a worker; progress and retry
- **Perf:** scenario: edit with drag while an upload runs — zero LoAF.
- **Browser check:** change one spread, publish, only changed files upload, the live site updates; the editor stays smooth during upload.
- **UI ref:** `uikit#/feature/in-app-publish`
- **UI kit:** `uikit/src/features/m5m7.tsx:333-336` (`in-app-publish` demo + notes), `UI ref: uikit#/feature/in-app-publish` — Publish progress + retry, `uikit/src/components/ui/progress.tsx`
