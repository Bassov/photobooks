# prod-kit-fixes

Tag: feature
Milestone: P2
Title: Bug: prod differs from kit in 3 places (Designer kit-sync Spec P1–P3)
Status: done

## Scope

- [x] P1 Settings opened from the editor: back bar «Back» rgb(83,81,82), label x 46 → kit «Back to the book» rgb(57,55,56), label x 38 (as the library variant). `src/editor/EditorSettings.tsx`
- [x] P2 Filmstrip header buttons Add folder…, Unplaced, Added order: border-radius 8 → pill (≥ 9999 px), height 28 unchanged
- [x] P3 Create book custom size: the size hint follows typing (H 23 → «19 × 23 cm» at once, not on blur); fields show «19», not «19.0» (step 0.1 kept). `src/editor/CreateBookDialog.tsx`
- **Bug rule:** every caller of each broken path (back links into the editor, filmstrip header buttons, `NumberField` format / commit-on-blur) is fixed or listed in the PR body with a reason
- **Done when:** P1 text, ink and label x in DOM; P2 computed radius ≥ 9999 px on all three; P3 unit test types H 23 → «19 × 23 cm» without blur and W renders «19»; unit + affected e2e + stryker-diff green; PR body has before/after numbers and tracker ids P1–P3
- **Perf:** N/A — no new interaction; the live hint is one state update in a dialog
- **Browser check:** editor ⚙ → back bar reads «Back to the book» in ink; filmstrip header buttons are pills at rest and on hover; Custom size… → type 23 in Height, the hint reads «… × 23 cm» before leaving the field
- **Hard nos:** no edits in `uikit/`, `src/editor/frameArrange.ts`, `galleryDrop.ts`, `ConnectedSpreadView.tsx`, `frameSelection.ts`, `src/editor/LayoutSection*`, `layoutThumb.ts`, parent-spreads files (other lanes)
- **Source:** Designer kit-sync Spec, section "Prod bugs" (P1–P3)
- **UI kit:** `uikit#/demo` step 40 (`uikit/src/demo-parts/settings.tsx` back bar); `uikit/src/features/create-book.tsx` (custom size hint); filmstrip header Add folder… pill (`uikit/src/demo-parts/editor.tsx`)
