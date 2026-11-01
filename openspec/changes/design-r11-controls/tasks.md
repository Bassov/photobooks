## Implementation

- [x] 1. M68: base-layer `input, textarea, select` font/colour inherit; W/H inputs and PRINT B/S values `font-mono`.
- [x] 2. M70: `Button` box model (border 0, sm 12 / md 16) and borderless `secondary`; Crop idle `secondary`, Flip H/V `outline`; `docs/design.md` Button row.
- [x] 3. M71: Settings nav invisible 1 px right edge as padding (`pr-[13px]`, no border), `bg-accent` active row, ink back crumb; library bar "Change library folder…" 24 px pill.
- [x] 4. Unit tests for the changed call sites; `e2e/design-r11-controls.spec.ts` with kit values and the no-Arial input audit.

## Manual test scenarios

1. 1440 × 900 welcome → empty library: Create Library / Create book pills, "Change library folder…" 24 px pill.
2. Create book dialog ("Lake trip"): Cancel / Create book padding 16; title input Inter 13.
3. Book settings, Cover, Photo inspector (+ Crop): inputs Inter (W/H mono), 90° / Crop shadow, Flip flat.
4. Settings from library: ink "Library" crumb, selected nav row #CFCFCF 195 px.
