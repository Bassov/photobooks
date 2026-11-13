## Implementation

- [x] 1. `SiteSettings` type, `parseSiteSettings`, `library.json` parse / serialize and the memory adapter; unit + PBT (C1) — `src/project/siteSettings.test.ts`
- [x] 2. `SiteMeta.theme`, `siteMetaOf(meta, url?)` + unit (C1) — `src/site/siteModel.test.ts` `siteMetaOf`
- [x] 3. `siteSettingsStore.ts` + `?siteSettings=` seed, bound in `projectSession.ts`; `siteSettingsStore.test.ts` (C2)
- [x] 4. Export and publish requests carry `siteMetaOf`; `buildSiteTree` test for `<title>` / lead with and without site settings (C3) — `buildSiteTree.test.ts`, `exportSiteRun.test.ts`, `startPublish.test.ts`

## Manual test scenarios

N/A (no UI; the Settings → Site section is the `site-settings` item).
