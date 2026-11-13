# site-settings-core

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-settings-core
Status: done

## Scope

The data core of Settings → Site (no UI) from the Designer Spec `site-settings` (S2–S7, § Prod changes Core + store + Export / publish). Item 2 of 4; the theme CSS / GL and the Settings UI are later items.

- [ ] C1 `src/project/types.ts` `LibraryMeta.site?: { title?, author?, intro?, theme?: 'light' | 'dark' }`, parsed in the `library.json` reader (unknown theme → absent; strings trimmed, inner whitespace collapsed, clipped to 80 / 80 / 160, empty → absent); `src/site/siteInput.ts` `SiteMeta.theme?`; `src/site/siteModel.ts` `siteMetaOf(meta, url?)` (S3: title "Photobooks", lead via `homeLead`); unit / PBT for clip, unknown theme, empty → absent and round trip
- [ ] C2 `src/editor/siteSettingsStore.ts` (shape of `printProfilesStore.ts`): bind / get / subscribe / `setSiteSettings(patch)`, read-modify-write queue, no write when unchanged, the S2 failure status, `?siteSettings=` test seed gated like `seedPrintProfilesFromQuery`; `siteSettingsStore.test.ts` covers queue order, failure status and no write when unchanged
- [ ] C3 `exportSiteRun.ts` sends `site: siteMetaOf(frozen.meta)`, `startPublish.ts` `siteMetaOf(frozen.meta, publicBaseUrl)` (S7); an exported site from a library with site meta has its `<title>` and lead text, without site meta the output is unchanged ("Photobooks")
- **Done when:** C1–C3 green
- **Perf:** N/A (no UI; one small object per export / publish)
- **Browser check:** N/A (no UI; the Settings → Site section is `site-settings`)
- **Hard nos:** no `uikit/**`, `src/site/book/**`, `src/site/siteSystem.css`, `src/site/renderSitePage.tsx`, `src/editor/Settings*`, `src/editor/SitePreview.tsx`; no backward compat (Owner 2026-11-02)
- **Source:** Designer Spec `site-settings` (orch `shared/design/site-settings/spec.md`)
