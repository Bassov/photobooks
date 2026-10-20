# design-tokens

Tag: feature
Milestone: M2.5
Title: tokens and self-hosted fonts
Status: done

## Scope

- [x] `src/ui/tokens.css`: primitive palette and scales → semantic tokens (surface, surface-raised, pasteboard, paper, ink, ink-muted, accent, on-accent, focus-ring, selection, drop-target, danger, warning, success, border); `prefers-reduced-motion` zeroes motion tokens
- [x] Self-hosted woff2 fonts (Latin + Cyrillic subsets, preload, `font-display`) replace the Google Fonts CDN link (`budget.json` third-party: 0)
- [x] Migrate `index.css`, `EditorShell.css`, `Filmstrip.css`, `SpreadView.css` to tokens; editor chrome only — book content colors stay document-driven
- [x] `scripts/check-css-tokens.mjs` in `verify:fast`: no raw colors / font sizes / radii outside `src/ui/tokens.css`
- [x] Dev/test-only `?specimen` page (same pattern as the painter fixture query parameter): token swatches, type scale, spacing. If over budget, the specimen moves to `ui-primitives-actions`
- **Perf:** tokens are static CSS custom properties, no runtime theming JS; fonts preloaded before first paint. Gate: existing pasteboard scroll, zoom and drag scenarios re-run — zero LoAF.
- **Browser check:** every existing surface (empty editor, import, filmstrip, pasteboard, template bar, camera bar) renders with the new tokens and fonts with DevTools offline after first load; no request to third-party hosts; no page-level H/V scroll.
- **UI ref:** `uikit#/feature/design-tokens`
- **UI kit:** `uikit/src/features/m25.tsx:193-202` (`design-tokens` demo + notes), `UI ref: uikit#/feature/design-tokens` — semantic tokens + local fonts specimen, `uikit/src/kit/theme.ts`

## Done note

Theme B tokens (`docs/design.md` names) + self-hosted fonts; chrome CSS migrated (incl. HomeScreen for CSS gate); check-css-tokens; ?specimen
