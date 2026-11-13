# design-r25-publish-cache

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r25-publish-cache

## Scope

Designer parity in-app-publish p4 (Must M112): spec P6 says content-hashed keys are put with `public, max-age=31536000, immutable`, but every built viewer asset (`viewer/assets/SiteRoom-BYCUx3i0.js`, `viewer/assets/three.module.min-DZQsI4wM.js`, …) goes up `no-cache`. `cacheControlOf` in `src/publish/publishSite.ts` only knows ≥16 hex chars; Vite names build files `assets/<name>-<8 base64url chars>.<ext>`. Lane: `src/publish/**` only.

- [ ] `cacheControlOf`: a `viewer/assets/<name>-<8 chars>.<ext>` key whose 8-char hash has an uppercase letter or a digit is immutable; the 16-hex rule stays; pages, data, non-hashed files (incl. `viewer/fonts/*`) stay `no-cache`, the manifest `no-store`
- [ ] Unit cases: `viewer/assets/SiteRoom-BYCUx3i0.js`, `viewer/assets/three.module.min-DZQsI4wM.js`, a hashed css → immutable; `index.html`, a book page, `viewer/x.js`, `viewer/assets/my-settings.js` → no-cache; manifest → no-store
- [ ] A fake-bucket publish of the real p4 viewer key list puts every `viewer/assets/` file with the immutable header
- **Done when:** the cases above pass; all existing `cacheControlOf` / publishSite cases stay green, unchanged.
- **Browser check:** N/A (worker upload headers; covered by unit tests with the fake bucket)
- **Hard nos:** nothing outside `src/publish/**`; no edits to existing test assertions.
