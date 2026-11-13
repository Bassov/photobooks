## Implementation

- [ ] 1. `SiteTexts.theme` (sample Light) and `--shadow-tile-rest` token
- [ ] 2. `SiteSection`: Site title / Author / Intro field rows (placeholders S3, counter, commit / Esc / paste) and the Theme radiogroup with miniatures
- [ ] 3. `SettingsScreen` Site branch + `onSite`; `DemoSettings` wires `set({ site })`
- [ ] 4. `DemoSite` / `DemoSitePreview` pass `dark` (+ Preview `texts`)
- [ ] 5. Feature page scenarios `site-empty`, `site-dark`, notes lines; personal-site `dark`
- [ ] 6. e2e `e2e/kit-site-texts.spec.ts` locks (K1–K3) and the `docs/design.md` line

## Manual test scenarios

1. `#/full/site-settings` Site: type a title, Enter; Esc after an edit reverts; Tab / arrows through the Theme tiles.
2. No values: placeholders Photobooks / Your name / A line or two about your books, `0 / 160`.
3. `#/demo` Settings → Site → Dark, Open site: home and room dark, browser bars dark; editor Preview dark.
