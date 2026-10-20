# static-export

Tag: feature
Milestone: M5
Title: write `dist/`

## Scope

- [ ] Prerender and file writes in a worker; progress and cancel
- **Perf:** scenario: edit with drag while the export writes — zero LoAF.
- **Browser check:** export to a folder while continuing to edit without stutter, serve it locally, open on phone and desktop; drafts are absent.
- **UI ref:** `uikit#/feature/static-export`
- **UI kit:** `uikit/src/features/m5m7.tsx:300-303` (`static-export` demo + notes), `UI ref: uikit#/feature/static-export` — export folder picker + progress/cancel, `uikit/src/components/ui/progress.tsx`, `uikit/src/components/ui/dialog.tsx`
