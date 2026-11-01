# design-r10-library

Tag: feature
Milestone: P1
Title: Bug: design-r10-library: Welcome, Library and Settings match the kit

## Scope

- [ ] M64: Library Lora display text ("Your books", the "Fog" example cover, "Your first story / starts here.", book-card cover titles) is weight 400 with the kit's synthesized italic; "Your books" letter-spacing is normal; the empty-library text column starts at x 749.19 and the paragraph sits 20 px under the headline; photo credit links (Library and Welcome) are rgb(83, 81, 82).
- [ ] M65: Welcome eyebrow y 242.91, paragraph y 482.24 (28 px under the headline), "for your books." as wide as the kit (581.58 px in the e2e renderer).
- [ ] M66: Settings crumb "Settings" x matches the kit (98 in the e2e renderer, 99.73 in the Designer's), section content no longer sits 3.5–4 px low ("Library folder" y 180.61), "Allowed · read and write" is rgb(57, 55, 56).
- **Done when:** `e2e/design-r10-library.spec.ts` green with `--repeat-each=30`; existing Welcome/Library/Settings specs, the full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900: Welcome, empty library, library with one book and Settings (from the library) line up with `uikit#/demo` steps `welcome`, `library-empty`, `library-one-book` and `settings-from-library` (positions ± 0.5 px; font size/weight/letter-spacing/colour exact).
- **UI kit:** `uikit/src/features/library.tsx` (WelcomeScreen :63, LibraryEmpty :101), `uikit/src/demo-parts/library.tsx` (Your books :42), `uikit/src/demo-parts/settings.tsx` (back bar :84, badge :48), `uikit/src/fonts/fonts.css` (upright Lora only). UI ref: `uikit#/demo`.
- **Source:** Owner rule: every Designer item is a Must; round 10, Designer review r9 2026-11-01 (M64–M66).
