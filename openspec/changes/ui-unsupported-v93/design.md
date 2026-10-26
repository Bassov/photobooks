## Decisions

1. **Port kit JSX into `src/`** — copy `Unsupported` / `CHROMIUM_BROWSERS` / Copy-link from `uikit/src/features/screen-demos.tsx` into `UnsupportedBrowserScreen`; never import `uikit/src/**`. Port `FeaturedIcon` (soft/warning used here) under `src/ui/`.
2. **Keep `getBrowserSupport()` as the sole boot gate** — still runs before `tryRestore` / IndexedDB. Extend snapshot with UI `variant` (`other` | `no-api` | `mobile`) + optional browser label: mobile → `mobile`; insecure, nested frame (`self !== top`), or Chromium-without-picker → `no-api`; else → `other` (UA brands only for copy/name, not the gate).
3. **Kit CTAs, no continue-anyway** — Get Google Chrome, other Chromium links (`rel="noopener noreferrer"`), Copy link; Reload after turning it on on `no-api`. Retire EmptyState placeholder + unsupported-only placeholder CSS usage.
4. **Icons without lucide** — add Lucide-compatible glyphs (`appWindow`, `shieldOff`, `monitorSmartphone`, `externalLink`, `copy`, `bookOpen`) to `src/ui/icons/glyphs.ts`.
5. **Tokens + scroll** — Theme B Tailwind utilities + `.heading`; grayscale chrome (warning FeaturedIcon uses gray `--warning`). Surface fills viewport; taller content scrolls only in `data-testid="unsupported-scroll"`.

## Touch-set & Test Plan

- Files: `UnsupportedBrowserScreen.*`, `browserSupport.*`, `src/ui/FeaturedIcon.*`, `glyphs` / Icon tests, `screenPlaceholdersStyles` (drop unsupported-only if unused), `openspec/.../editor-shell` delta, `App`/`e2e/library-screens` assertions, `docs/design.md` migration row if needed
- Reuse: kit screen-demos + FeaturedIcon as copy source; `cn`; app `Button`; `getBrowserSupport` call sites
- Tests: unit variants + CTAs/copy-link; e2e missing-picker → kit screen (Get Chrome visible), supported still Welcome; named `unsupported-scroll` + no page scroll
- UI: skill `ui-review` (empty / happy / interact) before push/archive
- Gates: no coverage / Stryker / e2e threshold weakening
