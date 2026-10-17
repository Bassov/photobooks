# template-unplace-notice

Tag: feature
Milestone: M1
Title: applying a smaller template still drops overflow placements, photos stay in the gallery, and a polite editor status says how many were unplaced (no status when zero)

## Scope

- **Perf:** status update is a narrow live-region write; template apply still re-renders only the affected spread.
- **Browser check:** shrink a filled spread template — overflow photos stay in the gallery, Placed badges clear, polite status announces the count (silent when zero); no page-level H/V scroll.
- **UI ref:** `uikit#/feature/template-unplace-notice`
