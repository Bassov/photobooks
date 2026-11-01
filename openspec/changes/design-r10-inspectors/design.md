## Decisions

1. Shared kit primitives `InspectorHead` / `InspectorSec` / `InspectorRow` (v7 `Head` / `Sec` / `Row`) in `InspectorControls.tsx` render Cover and Book settings. Endpaper stays untouched as the M48 reference.
2. Kit line-heights are set on inspector classes; global type tokens stay.
3. New `SegmentedControl` size `inspector` (kit `SegC`) for Book Portrait/Landscape and cm/mm; the Page size select gets the kit 32 px height locally.
4. Segmented labels are 500 in the shared class; the editor chrome drops the selected 600. Layout tabs change font only.
5. PHOTO, Fit & crop and Rotate & flip become `Disclosure`s open by default. `Disclosure` forwards `data-crop-keep` and drops its panel padding while closed.
6. A `fit-crop-slider--row` modifier gives Zoom and Straighten the kit `SliderRow` geometry while keeping the 14 px hit area.
7. Primitives from `docs/design.md`: Disclosure / Section, Segmented, Select, Slider / SliderRow, Badge; the inspector rhythm and the `inspector` size are recorded there.

## Touch-set & Test Plan

- Files: `src/editor/{InspectorControls.tsx,InspectorControls.css,CoverSection.tsx,CoverCanvas.css,BookSettingsSection.tsx,PhotoSection.tsx,PhotoSection.css,FitCropSection.tsx,FitCropSection.css,PhotoRotateSection.tsx,LayoutSection.css,editorChromeTokens.ts}`, `src/ui/{SegmentedControl.tsx,SegmentedControl.css,Disclosure.tsx,Disclosure.css}`, `docs/design.md`.
- Reuse: `Disclosure`, `SegmentedControl`, `ReadOnlyPill`, Endpaper geometry.
- Tests: unit for primitives, segmented size, Disclosure and photo sections; e2e `e2e/design-r10-inspectors.spec.ts` (positions ±0.5 px, type vs kit); Owner design change edits in `FrameSections.test.tsx`, `LayoutSection.test.tsx` and `e2e/design-r9-letter-spacing.spec.ts`. `ui-review` before push.
