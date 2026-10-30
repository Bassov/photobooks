## Implementation

- [x] Core ops `addGuide` / `moveGuide` / `removeGuide` + history labels (`src/core/ops/guides.test.ts`)
- [x] `guidesView` flag, Ctrl+; key and TopBar Guides toggle (`guidesView.test.ts`, `GuidesToggle.test.tsx`, `installEditorGridKeys.test.ts`)
- [x] `GuidesOverlay` editor layer in the spread overlay slot, off in Preview (`GuidesOverlay.test.tsx`, `PresentationMode.test.tsx`)
- [x] Ruler pull + placed-guide drag gesture with rAF transform and one commit (`guideGesture.test.ts`, `guidesMath.test.ts`, `Rulers.test.tsx`)
- [x] `e2e/guides.spec.ts` incl. frame-budget scenario

## Manual test scenarios

- Rulers on; pull a guide from each ruler; move one; drag one back onto its ruler; zoom; Ctrl+; ; Present.
- OK (Playwright `e2e/guides.spec.ts`, 7 scenarios incl. LoAF 0 under 4x CPU throttle).
