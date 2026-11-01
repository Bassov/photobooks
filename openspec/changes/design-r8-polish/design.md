## Decisions

1. M48: `EndpaperSection` renders the kit `Sec` / `Row` shape itself: two `px-4 py-4` sections, an `mb-3` title row with a margin-free eyebrow, rows `mt-3` at the kit text-sm line. The Style row is a three-child `justify-between` row (label, chip, "coming later"). Shared `InspectorRow` / `ReadOnlyPill` stay (Book / Cover use them).
2. M55: a single-page row (`data-page-side`) drops the spread-wide thumb box shadow and paints `--shadow-sm` on the page instead, so the empty half is unpainted (kit `LastPage` / clip).
3. M56: the pill centre sits `PAGE_LABELS_MIN_GAP_PX / 2` screen px under the gap centre: 19 + (gap − 19) / 2 = gap / 2 + 19 / 2, the midpoint between the page-number line bottom and the next spread. The shift is divided by `--cam-scale` like the labels. Hide threshold and stride unchanged.

## Touch-set & Test Plan

- Files: `EndpaperSection.tsx` + `EndpaperCanvas.css` (its CSS: section title, row); `SpreadsPanel.css` (override the injected `.editor-spread-thumb` shadow); `Pasteboard.tsx`, `pageLabelsModel.ts`, `EditorShell.css` (pill `top`); spec delta `pasteboard`.
- Reuse: tokens `--text-2xs`, `--text-sm`, `--shadow-sm`, `FIELD` / `SUB` / `T`; e2e fixtures `stackGap`, `zoomMenu`, `openLibraryBook`.
- Tests: unit — `pageLabelsModel` shift, `EndpaperSection` rows, pill `--pill-shift`. e2e `design-r8-polish.spec.ts`: M48 rows vs kit step 26; M55 empty-half paint and page rects; M56 mid-drag at Fit / ×2 / floor. `design-r7-spreads.spec.ts` pill assertion updated (Owner design change, round 8, M56).
