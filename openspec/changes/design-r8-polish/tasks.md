## Implementation

- [x] 1. M48: Endpaper inspector in the kit `Sec` / `Row` shape (row tops and Style row boxes = kit step 26). Evidence: `e2e/design-r8-polish.spec.ts` "M48 … row tops and the Style row boxes equal kit step 26"; `bookLookUi.test.tsx` "lays out the kit Fill and Apply sections"; commit eef9d530.
- [x] 2. M55: single-page list rows paint only the page (shadow on the page, none on the empty half). Evidence: `e2e/design-r8-polish.spec.ts` "M55 … first and last rows: empty half unpainted, page at the kit rect"; commit eef9d530.
- [x] 3. M56: new-spread pill centred between the page-number line and the next spread (`pageLabelsModel` + CSS). Evidence: `e2e/design-r8-polish.spec.ts` "M56 …" (Fit, ×2, zoom floor); `PageLabels.test.tsx` "centres the pill …"; `Pasteboard.multiDrop.test.tsx` `--pill-shift`; commit eef9d530.
- [x] 4. `e2e/design-r8-polish.spec.ts` (M48, M55, M56) and the r7 pill assertion as an Owner design change; unit tests for the changed files. Evidence: `--repeat-each=30 --retries=0 --workers=4` on r8 + r7 specs 360/360; commit 199847b4.

## Manual test scenarios

1. Select "Endpaper · front": rows match kit step 26; Style row reads label · chip · "coming later" across the width. — problem (harness entry, not reached): `pnpm agent manual-qa` stops at welcome, the start-session click is intercepted by the welcome header (pre-existing on main). Covered by `e2e/design-r8-polish.spec.ts` "row tops and the Style row boxes equal kit step 26".
2. Spread list: the first and last rows show only their page, no grey block on the empty half. — problem (harness entry, not reached): same welcome-header intercept. Covered by `e2e/design-r8-polish.spec.ts` "first and last rows: empty half unpainted, page at the kit rect".
3. Drag a filmstrip photo over a gap at Fit and at 200 %: the pill sits midway between the page numbers and the next spread; at the zoom floor there is no pill. — problem (harness entry, not reached): same welcome-header intercept. Covered by `e2e/design-r8-polish.spec.ts` M56 "Fit …", "×2 (200 %) …", "hidden at the zoom floor …".
