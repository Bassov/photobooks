## Implementation

- [x] 1. Home: EmptyState + Button (+ Status for errors/permission hint); keep testids + home scrollport
- [x] 2. EditorTopBar: Status lock banner; Status/Badge save indicator; Grant as primary Button
- [x] 3. RelinkDialog: Dialog + DialogTitle + Badge rows; preserve relink-* testids/behavior
- [x] 4. Drop HomeScreen Stryker bang-exclude; raise HomeScreen unit coverage for ≥85 / 0 NoCoverage
- [x] 5. Tick design.md migration rows for Home / permission / save / missing; keep CSS token-clean
- [x] 6. Existing e2e green for empty home, regrant, lock, save indicator, relink; ui-review

## Manual test scenarios

1. OK Fresh home (empty): EmptyState with New library / Open; no page scroll outside `home` scrollport.
2. OK Open a library + book; save indicator shows Saved / Unsaved / Saving… via Badge/Status (not ad-hoc red hex).
3. OK Force permission-required: Grant access primary; re-grant restores/continues without page scroll.
4. OK Second tab same book: lock Status banner; Save disabled; Open / New book still reachable.
5. OK Missing assets: Relink Dialog + Badge rows; Skip / Rescan / Resolve still work; no page-level scroll.
