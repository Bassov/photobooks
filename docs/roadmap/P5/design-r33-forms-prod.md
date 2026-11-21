# design-r33-forms-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r33-forms-prod
Status: done

Round 33 Musts M131, M132 (Designer parity walkthrough-ux-review p2), library / create-book forms lane. The kit is the reference; no kit edits.

## Scope

- [x] M131: the library empty sample card sub line "AUTUMN · 2025" (`src/render/BookObject.tsx` `book-object-sub`) gets line-height 15 px (1.5 × 10 px, as the kit inherits from preflight) instead of `normal` (12 px); text top 353.59 → 354.59 at 1440×900.
- [x] M132: the Create book Title field (`TextField`, only caller `CreateBookDialog`) starts its text at x = 526 like the kit (1 px field-coloured border + 11 px padding = kit's 12 px padding); field size and the app-wide ink focus outline unchanged. Select / NumberField keep their padding.
- [x] An e2e check pins both numbers at 1440×900.
- **Browser check:** library empty state at 1440×900: "AUTUMN · 2025" line-height 15px, top 354.59 (±0.25); New book → Title text x 526 (±0.25), field box unchanged (±0.5), focus outline 2 px muted-foreground.

## Done when

1. At 1440×900 the "AUTUMN · 2025" line computed line-height = 15px and its text box top within ±0.25 px of 354.59.
2. Create book Title text start x = 526 (±0.25) at 1440×900, field size unchanged (±0.5 px), focus outline unchanged.
3. An e2e check pins both numbers.
