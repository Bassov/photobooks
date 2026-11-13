# site-final-preview

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-final-preview

## Scope

Designer Spec `personal-site` "Prod changes" P6 (D45): the editor Preview shows the reading room of the open book, on top of P4 home (#568) and P5 room (#574).

- [ ] `src/editor/SitePreview.tsx`: the Preview (site-preview-mode) shows `SiteRoom` of the open book under the 48 px bar, painted from the live editor book; hidden: "All books", Share and the home; the head name is plain text; Fullscreen stays.
- [ ] `src/editor/SitePreviewBar.tsx` / `sitePreviewKeys.ts`: keys rule unchanged (Esc closes one layer per press: lightbox, then preview; no key reaches the editor).
- [ ] Old-site leftovers (`SiteStage`, `SiteCatalog`, `SiteBookPage`, old site css) and dead exports knip reports after P5: grep src, e2e, scripts; fix or delete each.
- [ ] Tests: `SitePreview.test.tsx`, `SitePreviewBar.test.tsx`, `sitePreviewKeys.test.ts` on the room; `e2e/site-preview-mode.spec.ts` asserts the room (no "All books", no Share, plain head name, Fullscreen opens the lightbox, Esc order) with a paint check that the room page is visible under the bar.
- **Browser check:** editor → Preview → the room of the open book under the bar; no "All books" / Share; the title is plain text; Fullscreen opens the lightbox; Esc closes the lightbox, then the preview.

## Done when

Preview shows the room of the open book with D45 hidden / kept controls (e2e + paint check); Esc closes one layer per press and no key reaches the editor (e2e); knip reports no dead site exports; unit + changed e2e, typecheck, lint, knip green; PR body lists before / after (preview controls, knip count).

Hard nos: `uikit/**`, `src/publish/**`, `.github/workflows/pr-policy.yml`, `docs/roadmap/P3/in-app-publish-kit.md`; `src/site/**` only for a preview prop and dead exports; no backward compat.
