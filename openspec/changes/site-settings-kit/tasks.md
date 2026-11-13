## Implementation

- [x] 1. `SiteSection`: Site title / Author / Intro field rows (placeholders S3, counter, commit / Esc / paste)
- [x] 2. `SettingsScreen` Site branch + `onSite`; `DemoSettings` wires `set({ site })`
- [x] 3. `DemoSitePreview` passes `texts`
- [x] 4. Feature page scenario `site-empty`, notes lines
- [x] 5. Remove the kit's dark look (CSS, `SiteProps.dark` chain, GL `dark` option)
- [x] 6. e2e `e2e/kit-site-texts.spec.ts` locks (K1, K3, one look, Preview lead)

## Manual test scenarios

1. `#/full/site-settings` Site: type a title, Enter; Esc after an edit reverts; no Theme row.
2. No values: placeholders Photobooks / Your name / A line or two about your books, `0 / 160`.
3. `#/demo` Settings → Site → edit the intro, back, editor Preview: the site is light and the home lead under the room is the new intro.
