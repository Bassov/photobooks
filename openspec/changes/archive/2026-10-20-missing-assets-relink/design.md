## Decisions

1. One subsystem: Relink overlay (`src/editor/relink/`). Status store + rAF rescan/apply exist only to drive that overlay (not a separate infra capability). Reuse `matchAssets`, scan/hash workers — no new domain matcher.
2. After library-backed restore/open: gallery assets with identity but no live `File` start as `missing`; rescan picks a folder, hashes entries (worker), then matches. Path+size/mtime drift with hash mismatch → `modified` (“Use new version” keeps crop, updates identity).
3. UI mirrors uikit RelinkDialog + missing pill; hatched frames via SpreadView when status is `missing`. Thin `RelinkHost` mounts from shell — avoid growing bang-excluded `EditorShell.tsx` logic.
4. Security: directory/file picks are read-only; never substitute on hash mismatch without explicit Resolve / Use new version. Test seams seed statuses + mock scan for e2e without real folder moves.
5. Skip for now keeps the book editable; pill remains until resolved.

## Touch-set & Test Plan

- Files: `src/editor/relink/*`, RelinkDialog/pill CSS, `SpreadView` hatch, thin EditorShell/Pasteboard wire, `openspec/specs/editor-shell` (+ spread-view hatch if needed), `e2e/missing-assets-relink.spec.ts`, stryker excludes untouched unless a bang file must change (prefer extract).
- Reuse: `matchAssets`, FSA/memory `AssetSource`, import rAF progress pattern, existing pick helpers, DerivedCache thumbs after apply.
- Tests: unit/PBT on apply+status transitions; e2e empty/happy/rescan+filmstrip scroll; skill `ui-review` before push.
