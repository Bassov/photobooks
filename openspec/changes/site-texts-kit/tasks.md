## Implementation

- [ ] 1. Session `site` texts; Settings → Site rows Site title, Author, Intro (clamp / "Not set"); `site-settings` scenario "Intro not set"
- [ ] 2. `siteLead` (D37) and `SiteProps.texts`; home lead / no lead on desktop and phone; `DemoSite` passes the session texts
- [ ] 3. Delete `site-photographer.tsx`; cut `site-viewer.tsx` to the lightbox; `Std` default top = `TopBar`; drop the `site-viewer` / `site-photographer` page entries
- [ ] 4. qa.mjs site smokes: room → Fullscreen → lightbox on `personal-site`; lightbox smokes keep `site-fullscreen-btn`
- [ ] 5. e2e `e2e/kit-site-texts.spec.ts`

## Manual test scenarios

1. Kit `#/full/site-settings`, Site: the Intro row shows the sample in at most 2 lines, right-aligned; "Intro not set": "Not set".
2. `#/demo` Open site: the home lead is the intro; Fullscreen in the room opens the lightbox.
