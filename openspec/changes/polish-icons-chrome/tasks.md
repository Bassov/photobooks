## Implementation

- [x] 1. P6 prod: stroke by size in `Icon.css`; 10 px Low-res and placed check at 2 (`e2e/polish-icons-chrome.spec.ts` prod tests).
- [x] 2. P6 kit: `svg.lucide` stroke rules in `uikit/src/index.css` (`e2e/polish-icons-chrome.spec.ts` kit test).
- [x] 3. P8 prod: `SiteJobPill` `primary`, Publish ink pill states in `ExportSiteButton.css`, `--primary-busy` token (`PublishButton.test.tsx`, `in-app-publish.spec.ts`, `polish-icons-chrome.spec.ts`).
- [x] 4. P8 kit: `#/demo` Publish ink pill (`kit-in-app-publish.spec.ts`, `kit-editor-chrome.spec.ts`, `polish-icons-chrome.spec.ts`).
- [x] 5. P9: `--dot` .30 in prod and kit (`polish-icons-chrome.spec.ts` paint check).
- [x] 6. Old-look pins updated (`design-tokens`, `kit-pdf-export`, `print-dialog`, `ExportSiteButton.test.tsx`); `docs/design.md` tokens / iconography.

## Manual test scenarios

1. Editor with photos at 1440×900: Publish is the only dark pill; hover lightens it; Tab focus shows a 2 px outline; Preview / Export site / Print stay grey.
2. Start a publish and hide the dialog: the pill is light grey #BFBDB9 with an ink progress fill and NN%.
3. Icons in the top bar and panels look thinner; filmstrip Low-res and placed check glyphs stay crisp at 10 px.
4. Canvas dots are fainter.
