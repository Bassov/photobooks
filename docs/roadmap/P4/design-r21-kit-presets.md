# design-r21-kit-presets

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item design-r21-kit-presets
Status: done

## Scope

- [x] Kit new book takes the default profile's bleed and safe margin like prod (Designer printer-presets M102): `BOOK0.safe` 5 mm = Generic (`uikit/src/sandbox/store.tsx`); kit qa expects S 5 (`uikit/scripts/qa.mjs`).
- [x] Kit Book settings PRINT warns once per page side out of the profile trim range, prod wording (M103; `uikit/src/demo-parts/printProfiles.tsx` `printIssues`). Kit only, no `src/` edits.
- **Browser check:** kit `#/demo` Book settings on Generic: B 3 mm / S 5 mm; A5 against a 30–50 cm custom profile shows two warnings (wide, high).

## Done when

- Kit e2e: a new kit book on Generic shows Safe 5 mm and the default profile's bleed; A5 against a 30–50 cm profile shows two warnings, same text as prod.
- Prod (`src/`) untouched.
