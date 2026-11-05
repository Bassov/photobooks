# printer-presets-core

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item printer-presets-core

## Scope

Item 1 of the Designer `printer-presets` Spec (2026-11-05): print profile core, no UI. Items `printer-presets-kit` and `printer-presets` (prod) build on it.

- [ ] `src/core/print/catalog.ts` (zod-free): built-in profiles = Generic, then sourced shop profiles A→Z; each shop profile carries `source` (vendor URL) and `checked` (ISO date) and every number comes from the vendor's own spec page or template (Spec D8). A vendor whose trim range, bleed, safe margin and page count cannot all be confirmed is left out (the PR body says which)
- [ ] `printProfile.snapshot` (optional, parsed with the profile schema; absent = none) and the lookup order built-in id → library custom id → snapshot → Generic with an `unknown-profile` issue (Spec D6)
- [ ] `src/core/pages.ts` page-count range `[20, min(120, profile.max)]` in the profile step from 20 (Spec D5); Book settings Pages (`setPageCount`) clamps to the book profile's range
- [ ] Print warnings (trim, bleed, fewer / more pages than the profile, unknown profile) and their Book settings strings, profile summary / hint strings, profile editor messages (Spec D5, Book settings, Profile editor)
- [ ] Op `setPrintProfile {id}` (one undo step): `{id, overrides: {}}` (+ snapshot for a custom profile), bleed clamped to the profile range, safe margin = the profile's; trim and page count unchanged (Spec D4)
- [ ] `library.json` v4: `printProfiles` (custom profiles) and `defaultPrintProfileId` with migration; new books use the library default (unknown → Generic) and its bleed / safe margin (Spec D6, `projectSession.ts`)
- **Kit components:** none (core only, no UI)
- **Demo:** n/a (core only)
- **Browser check:** none: no UI change; a new book still shows Pages 20–120 and B/S 3 / 5 mm (Generic)
- **Done when:** unit + PBT for the profile pick, the resolution order and page-count rounding; Generic keeps Pages 20–120 and B/S 3 / 5 (existing tests stay green)
- **Musts:** catalog numbers are sourced, never guessed; `printProfile.ts` and the catalog import no zod; no compat shims beyond the migration the spec names (Owner 2026-11-02)
- **Hard nos:** no UI; no changes under `uikit/`, `src/editor/**` UI components, `e2e/`
- **Test:** unit + PBT on the pure modules; no e2e (no UI); no perf scenario (no interaction)
- **UI kit:** none (no matching component)
- **Source:** Designer Spec `printer-presets` (orch `shared/design/printer-presets/spec.md`), Decisions D3–D9, "Spec — Book settings", "Spec — Profile editor dialog" messages, "Prod changes" core lines, "Items" 1
