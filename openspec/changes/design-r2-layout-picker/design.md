## Decisions

1. **Catalog.** `TEMPLATE_IDS` + `hero-two`, `hero-grid`, `panorama`, `three-across`, `framed-single`, `offset-pair`, derived from page content boxes and gutters (kit ratios only for 7:2 / 70%). `2-up` / `4-grid` stay for stored books and `bestTemplateId`. Picker order (kit `data.ts` + `templates.ts` `EXTRA`) and names: `src/editor/layoutCatalog.ts`.
2. **Thumb.** Kit `TemplateThumb` markup replaces the SVG: 2:1 box, paper box at the spread aspect, slots clamped to trim (`layoutThumb.ts`, pure) with `overflow: hidden`, spine on two-page spreads — fixes the Full bleed letterbox lines.
3. **Header.** `ui/Disclosure` gains kit `SectionHeader` `summary` (collapsed only) and `right` (expanded only); Layout passes the "Save as template" `+`.
4. **Hover preview.** Store `templatePreview.ts` (`{spreadId, templateId}`), set on tile hover / focus, cleared on leave / blur / apply / unmount; `TemplatePreviewOverlay` subscribes per spread.
5. **Preview (M25).** With `editorLayer={false}` `ConnectedSpreadView` passes no `frameControlFor` and no overlay, so frames are inert divs; selection state is untouched.
6. **Inspector header (M2).** One 48 px row: icon + title + meta + "Hide inspector (I)" with new glyphs `panelRightClose`, `sparkles`.

7. **Saved templates.** `savedTemplates.ts`: a localStorage list (Zod-checked on load, bad data → empty) of `{id: user-…, name, slots %}`; core `spreadLayoutSlots` / `customLayoutRects` / `applyCustomLayout` turn a spread into percent slots and back (photos by index), so saved ids never enter `TEMPLATE_IDS`. `?templates=kit` seeds on the first read, gated on `DEV || VITE_TEST_FIXTURES`.
8. **Spread sections.** `Spread.masterId` (optional enum, absent = A) + `setSpreadMaster` / `setSpreadBackground` ops (one history step); Margin / Gap write the spread grid override, so templates re-flow; `InspectorSlider editableValue` = kit `SliderValueField` (draft in a ref so the synchronous blur after Enter / Escape sees it cleared).

## Touch-set & Test Plan

- `src/core/{schema.ts,ops/spreadLook.ts,ops/applyBookOp.ts,templates/custom.ts,templates/apply.ts}` + unit tests; `src/editor/{savedTemplates.ts,SpreadSections.tsx,.css,GridSection.tsx,.css,InspectorControls.tsx,.css}` + unit tests; e2e `design-r2-layout-picker.spec.ts` (kit section order, seed, save → reload, section boxes / writes).

- `src/core/templates/{types,catalog}.ts`: exact rects + inside / non-overlap tests per layout.
- `src/editor/{LayoutSection.tsx,.css,layoutCatalog.ts,layoutThumb.ts,templatePreview.ts,TemplatePreviewOverlay.tsx,ConnectedSpreadView.tsx,Inspector.tsx}`, `src/ui/{Disclosure.tsx,.css,icons/glyphs.ts}`: unit tests.
- e2e `design-r2-layout-picker.spec.ts` (empty My templates, happy kit order / sizes / clip, hover), `preview-no-overlays.spec.ts`; old specs move off `2-up` / `4-grid`. `ui-review` before push.
- Tokens (`styles/tokens.css`, already present): `--paper`, `--placeholder-block`, `--shadow-hairline`, `--sel`, `--field`, `--color-mark`, `--text-2xs`, `--radius-2xs`.
