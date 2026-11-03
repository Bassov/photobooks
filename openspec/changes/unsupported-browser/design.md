## Decisions

1. One unlayered hand stylesheet (`ub-` classes, no preflight reliance), procreate-light tokens from `docs/design.md`, no new tokens. The kit keeps a byte-identical copy `uikit/src/features/unsupported.css` (the kit cannot import prod); a prod unit test reads both files and fails on drift.
2. Narrow layout = `@media (max-width: 639px)` plus `[data-narrow]` on the root for the mobile variant, same rules.
3. Prod keeps RAC `Link` / `Button` (states via `data-hovered` / `data-pressed` / `data-focus-visible`); model `chromeOutline` → `chromeSecondary`; Brave `note` → `flag`.
4. UA detection stays pure behind `getBrowserSupport(host)`: exported `uaBrowserName(ua)` plus a mobile test on `userAgentData`, UA and `maxTouchPoints`.

## Touch-set & Test Plan

| Path                                      | Why                                  |
| ----------------------------------------- | ------------------------------------ |
| `src/editor/UnsupportedBrowserScreen.tsx` | rebuild                              |
| `src/editor/UnsupportedBrowserScreen.css` | new hand CSS                         |
| `src/editor/unsupportedScreenModel.ts`    | `chromeSecondary`                    |
| `src/editor/browserSupport.ts`            | mobile + name fallback               |
| `styles/app.css`                          | `a` into `@layer base`               |
| `uikit/src/features/unsupported.tsx`      | kit page                             |
| `uikit/src/features/unsupported.css`      | copy of prod CSS                     |
| `uikit/src/demo-parts/session.tsx`        | `Stage` + state                      |
| `uikit/src/demo-parts/root.tsx`           | render stage                         |
| `uikit/src/features/demo.tsx`             | `__demo.unsupported`                 |
| `uikit/scripts/demo-capture.mjs`          | 3 steps                              |
| `styles/tokens.css`                       | dead `--radius-device` (prod mirror) |
| `uikit/src/index.css`                     | dead `--radius-device`               |
| `uikit/src/demo-parts/settings.tsx`       | stale comment                        |
| `e2e/library-screens.spec.ts`             | computed-style + mobile cases        |

- Reuse: `FeaturedIcon`, `Icon`, RAC `Link` / `Button`.
- Tests: see tasks 1–3 and 6; the CSS drift test lives in `UnsupportedBrowserScreen.test.tsx`.
