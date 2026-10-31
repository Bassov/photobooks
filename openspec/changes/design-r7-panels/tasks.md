## Implementation

- [x] M54 remove the inspector hide button; Owner design change in `design-r2-layout-picker`, `design-r2-inspector`, `ui-panels` specs (`Inspector.test.tsx`, `EditorShell.test.tsx`)
- [x] M48 Endpaper context opens on its kit head (`Inspector.test.tsx`)
- [x] M50 filmstrip wheel scrolls sideways (`filmstripWheel.test.ts`)
- [x] M53 Preview starts on the cover (`PresentationMode.test.tsx`, `SpreadPager.test.tsx`)
- [x] M47 One per page stays in Suggested for 1 photo (`LayoutSection.picker.test.tsx`)
- [x] `e2e/design-r7-panels.spec.ts` (M47, M48, M50, M53, M54)

## Manual test scenarios

- Page 1: Suggested for 1 photo → Full bleed, One per page (pressed), Panorama; apply Full bleed, then One per page; Endpaper front head; wheel over filmstrip; Preview → Cover → Next; top-bar inspector toggle.
- OK (Playwright `e2e/design-r7-panels.spec.ts`, 5 scenarios, `--repeat-each=30`).
