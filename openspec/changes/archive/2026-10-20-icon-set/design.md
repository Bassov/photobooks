## Decisions

1. **In-repo SVG set** (not `lucide-react` in the app): ~24 named paths under `src/ui/icons/`, stroke 2, `currentColor`, 24×24 viewBox. Avoids a new production dependency; kit may keep lucide as visual reference. Record in `docs/design.md` Iconography + migration audit.
2. **`Icon` primitive** (`src/ui/Icon.tsx`): `name` + size token **14 / 16 / 20** (CSS `--icon-size-*` in `tokens.css`). Default decorative → `aria-hidden`; non-decorative requires `label` (accessible name). Icon-only controls must supply a label (documented; IconButton later).
3. **Names** align kit specimen: undo, redo, zoomIn, zoomOut, fit, addSpread, duplicate, delete, grid, guides, rulers, text, image, lock, eye, warning, info, check, present, export, settings, chevronLeft, chevronRight, folder (~24).
4. **Specimen:** extend `?specimen` with an icon grid (size toggle 14/16/20). No bang-excluded file edits unless required; prefer `SpecimenPage` / `Icon` (mutate-covered).
5. `skip_specs: true` — UI chrome only.

## Touch-set & Test Plan

- Files: `src/ui/Icon.tsx`, `src/ui/icons/*`, `src/ui/tokens.css`, `src/ui/SpecimenPage.*`, `docs/design.md`, roadmap item; tests; e2e specimen if needed.
- Reuse: kit glyph set / a11y rules from `docs/design.md`; existing `?specimen` mount.
- Tests: unit Icon sizes + a11y (decorative vs labeled); SpecimenPage lists icons; e2e empty `/` + painter (filmstrip/pasteboard scrollports) + specimen section (specimen scrollport); `ui-review` before archive.
