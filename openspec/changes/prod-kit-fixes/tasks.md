## Implementation

- [x] 1. P1: editor Settings back bar `Back to the book` with `pb-settings-back` + library styles injected (unit + e2e: text, ink, label x). `EditorSettings.test.tsx` "labels the back bar like the kit…"; `design-create-library-chrome.spec.ts` top bar test.
- [x] 2. P2: `.film-chip` pill radius for Add folder…, Unplaced, Added order (unit + e2e radius ≥ 9999 px). `editorChromeTokens.test.ts` (P2); `kit10-filmstrip.spec.ts` "dock header chips are kit pills…".
- [x] 3. P3: `formatNumber` drops trailing zeros; `NumberField` `live`; Create book custom size uses it (unit: H 23 → `19 × 23 cm` without blur, W `19`). `CreateBookDialog.test.tsx` "updates the custom size hint while typing…"; `forms.test.tsx` live; `library-screens.spec.ts` step 07.

## Manual test scenarios

1. Editor → ⚙ Settings: back bar reads `Back to the book` in ink; click returns to the editor.
2. Filmstrip header: Add folder…, Unplaced, Added order are pills; hover keeps the pill.
3. Library → New book → Custom size…: type 23 in Height; hint reads `… × 23 cm` before leaving the field; Width shows `19`, not `19.0`.

manual-qa (`pnpm agent manual-qa --change prod-kit-fixes`): problem (harness) — all three stop at the welcome screen, `start-session` click intercepted by the welcome header (known harness issue); nothing verified manually. Evidence instead, green in B: 1 → `design-create-library-chrome.spec.ts` top bar test (text, rgb(57, 55, 56), label x 38); 2 → `kit10-filmstrip.spec.ts` "dock header chips are kit pills…" (radius ≥ 9999 at rest + hover, h 28); 3 → `library-screens.spec.ts` step 07 (`19 × 23 cm` while focused, W `19`).
