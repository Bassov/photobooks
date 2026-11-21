## Decisions

1. P6: stroke in CSS by size. Prod `Icon.css` by `data-size` (12/14 → 1.5, 16/20 → 1.75); 10 px Low-res and placed check → 2. Kit: `svg.lucide` rules by `size-*` classes in `index.css` (no kit icon wrapper exists).
2. P8: `SiteJobPill` `primary` prop (prod and kit), painted from CSS, not inline: `--primary`, `--primary-foreground`, `--shadow-xs`, hover / focus `--primary-hover`.
3. P8 running: new token `--primary-busy` #BFBDB9 (docs/design.md), no shadow; the progress fill is ink.
4. P9: `--dot` .30 in prod and kit tokens.

## Touch-set & Test Plan

| Path                                          | Why                       |
| --------------------------------------------- | ------------------------- |
| `src/ui/Icon.tsx`                             | drop fixed stroke         |
| `src/ui/Icon.css`                             | stroke by size            |
| `src/editor/Filmstrip.css`                    | Low-res stroke 2          |
| `src/editor/editorChromeTokens.ts`            | placed check 10 px        |
| `src/editor/export/SiteJobPill.tsx`           | `primary` prop            |
| `src/editor/publish/PublishButton.tsx`        | Publish primary           |
| `src/editor/export/ExportSiteButton.css`      | ink pill states           |
| `styles/tokens.css`                           | `--dot`, `--primary-busy` |
| `uikit/src/index.css`                         | tokens, lucide stroke     |
| `uikit/src/demo-parts/editor.tsx`             | kit ink pill              |
| `docs/design.md`                              | token, iconography        |
| `e2e/polish-icons-chrome.spec.ts`             | new P6 / P8 / P9          |
| `e2e/kit-in-app-publish.spec.ts`              | running, width, hover     |
| `e2e/in-app-publish.spec.ts`                  | running look              |
| `e2e/design-tokens.spec.ts`                   | Publish ink               |
| `e2e/kit-editor-chrome.spec.ts`               | Publish ink               |
| `e2e/kit-pdf-export.spec.ts`                  | cluster x                 |
| `e2e/print-dialog.spec.ts`                    | cluster x                 |
| `e2e/kit-tokens.spec.ts`                      | Publish ink allowed       |
| `src/editor/publish/PublishButton.test.tsx`   | primary branch            |
| `src/editor/export/ExportSiteButton.test.tsx` | secondary fill            |
| `src/editor/EditorTopBar.test.tsx`            | Publish not inline        |

Tests: unit for the `primary` branch; e2e computed style + pixels. No PBT (CSS values).
