## Decisions

1. P6 prod: stroke lives in `src/ui/Icon.css` by `data-size` (12/14 → 1.5, 16/20 → 1.75); `Icon.tsx` drops its `strokeWidth={2}` attribute. CSS also covers the `pb-icon` glyph helpers (`exportSiteGlyphs.tsx`, the hosting spinner) without editing them. The 10 px status glyphs set 2: Low-res chip in `Filmstrip.css`; the placed check moves from 14 px / stroke 3 to the kit's 10 px / 2 in `editorChromeTokens.ts` (runtime CSS wins there).
2. P6 kit: no icon wrapper exists, so `uikit/src/index.css` styles `svg.lucide` by its own `size-*` class or a parent `[&_svg]:size-*` / `[&>svg]:size-*` (parent rules last, as Tailwind's parent selector wins the size). `sandbox/chrome.tsx` is untouched (its `strokeWidth={3}` attribute loses to CSS).
3. P8: `SiteJobPill` gets `primary` (prod and kit); Publish sets it. Prod clears ChromeButton's inline ghost look and paints from `ExportSiteButton.css` (`--primary`, `--primary-foreground`, `--shadow-xs`, hover `--primary-hover`, focus outline 2px `--primary-hover` at 2; `--ring` resolves differently under kit themes). Running: new token `--primary-busy` #BFBDB9 (docs/design.md), no shadow; the progress fill turns ink (`--primary`) so it still reads on #BFBDB9. Disabled keeps .5 opacity like the kit Button. Inset 0 12 (the 14 px Publish rule is removed).
4. P9: `--dot` alpha .30 in `styles/tokens.css` and `uikit/src/index.css`.

## Touch-set & Test Plan

| Path                                          | Why                                            |
| --------------------------------------------- | ---------------------------------------------- |
| `src/ui/Icon.tsx`                             | drop the fixed stroke attribute                |
| `src/ui/Icon.css`                             | P6 stroke by size                              |
| `src/editor/Filmstrip.css`                    | Low-res glyph stroke 2                         |
| `src/editor/editorChromeTokens.ts`            | placed check 10 px / stroke 2                  |
| `src/editor/export/SiteJobPill.tsx`           | `primary` prop                                 |
| `src/editor/publish/PublishButton.tsx`        | Publish is primary                             |
| `src/editor/export/ExportSiteButton.css`      | P8 ink pill states                             |
| `styles/tokens.css`                           | `--dot`, `--primary-busy`                      |
| `uikit/src/index.css`                         | `--dot`, `--primary-busy`, lucide stroke rules |
| `uikit/src/demo-parts/editor.tsx`             | kit Publish ink pill                           |
| `docs/design.md`                              | `--primary-busy`, iconography stroke           |
| `e2e/polish-icons-chrome.spec.ts`             | new: P6 / P8 / P9 on prod and `#/demo`         |
| `e2e/kit-in-app-publish.spec.ts`              | running look, width 69.58, hover               |
| `e2e/in-app-publish.spec.ts`                  | running look and paint                         |
| `e2e/design-tokens.spec.ts`                   | Publish ink, 0 12                              |
| `e2e/kit-editor-chrome.spec.ts`               | Publish ink (was quiet)                        |
| `e2e/kit-pdf-export.spec.ts`                  | cluster x +4                                   |
| `e2e/print-dialog.spec.ts`                    | cluster x +4                                   |
| `src/editor/publish/PublishButton.test.tsx`   | primary class, no inline look                  |
| `src/editor/export/ExportSiteButton.test.tsx` | secondary keeps the field fill                 |

Tests: unit for the `primary` branch; e2e computed style + pixels (hover, running fill, dot paint). No PBT (CSS values).
