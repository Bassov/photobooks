## Implementation

- [ ] 1. M48: Endpaper inspector in the kit `Sec` / `Row` shape (row tops and Style row boxes = kit step 26).
- [ ] 2. M55: single-page list rows paint only the page (shadow on the page, none on the empty half).
- [ ] 3. M56: new-spread pill centred between the page-number line and the next spread (`pageLabelsModel` + CSS).
- [ ] 4. `e2e/design-r8-polish.spec.ts` (M48, M55, M56) and the r7 pill assertion as an Owner design change; unit tests for the changed files.

## Manual test scenarios

1. Select "Endpaper · front": rows match kit step 26; Style row reads label · chip · "coming later" across the width.
2. Spread list: the first and last rows show only their page, no grey block on the empty half.
3. Drag a filmstrip photo over a gap at Fit and at 200 %: the pill sits midway between the page numbers and the next spread; at the zoom floor there is no pill.
