## Implementation

- [x] 1. `cacheControlOf`: add the `viewer/assets/<name>-<8 base64url, ≥1 upper or digit>.<ext>` immutable rule beside the 16-hex rule (`src/publish/publishSite.ts` `isViteHashed`)
- [x] 2. Unit rows: SiteRoom / three.module.min / hashed css → immutable; `index.html`, book page, `viewer/x.js`, `viewer/assets/my-settings.js` → no-cache; manifest → no-store (`publishSite.test.ts` "Vite build name …")
- [x] 3. Fake-bucket publish of the p4 viewer key list: all `viewer/assets/` immutable, `viewer/fonts/` no-cache (`publishSite.test.ts` "a published built viewer stores every viewer/assets/ file immutable")

## Manual test scenarios

N/A: worker upload headers, no UI. The fake-bucket publish test covers what is stored. A local `vite build` emits 38 files under `assets/`, and all 38 match the rule.
