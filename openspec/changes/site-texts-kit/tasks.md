## Implementation

- [x] 1. Session `site` texts; Settings → Site rows Site title, Author, Intro (clamp / "Not set") — `e2e/kit-site-texts.spec.ts` (Settings → Site texts)
- [x] 2. `siteLead` (D37) and `SiteProps.texts`; home lead / no lead on desktop and phone; `DemoSite` passes the session texts — `e2e/kit-site-texts.spec.ts` (kit site lead)
- [x] 3. Delete `site-photographer.tsx`; cut `site-viewer.tsx` to the lightbox; `Std` default top = `TopBar`; drop the `site-viewer` / `site-photographer` page entries — uikit typecheck, qa "all feature pages render cleanly"
- [x] 4. qa.mjs site smokes: room → Fullscreen → lightbox on `personal-site`; lightbox smokes keep `site-fullscreen-btn` — `uikit:qa:quick` 422 passed / 0 failed
- [x] 5. e2e `e2e/kit-site-texts.spec.ts` — 7 passed

## Manual test scenarios

1. Kit `#/full/site-settings`, Site: the Intro row shows the sample in at most 2 lines, right-aligned; an empty intro reads "Not set".
2. `#/demo` Open site: the home lead is the intro; Fullscreen in the room opens the lightbox.

- OK (kit-only; agent manual-qa drives the prod editor, not the kit): scenario 1 by `e2e/kit-site-texts.spec.ts` (row label + hint, value ≤ 320 px right-aligned, long intro height = 2 line heights with the band below painting the row colour, "Not set" on top via `elementsFromPoint`); scenario 2 by the same spec (lead = intro / `Photobooks by {author}.` / none with the case at 104) and qa `personal-site: bookcase → room → Fullscreen lightbox; Esc back to the room`; the #/demo walk baseline (80 steps) regenerated into `.cache/agent/demo-baseline` without errors.
- ui-review: OK — the Intro row reuses the Settings `row` and the `muted-foreground` token; read-only value (no interactive states); focus rings on the site controls pass qa (10 solid 2px); empty and happy states locked by e2e.
