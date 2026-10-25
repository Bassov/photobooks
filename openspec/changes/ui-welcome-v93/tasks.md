## Implementation

- [x] 1. Copy hero `c18.jpg` + port PhotoCaption/c18 credit; add `bookOpen` glyph — `public/photos/hi/`, `welcomeCredits.ts`, `WelcomePhotoCaption.tsx`, `glyphs.ts`
- [x] 2. Replace `WelcomeScreen` with kit layout (Mark, hero drift, Create Library, plain credit); wire choose/regrant/loading/error — `WelcomeScreen.tsx` + `.css`
- [x] 3. Retire welcome bits of `screenPlaceholdersStyles`; update design.md Welcome gap — done
- [x] 4. Update unit + e2e welcome specs (Create Library / credit / scroll); leave UnsupportedBrowserScreen alone — unit + `library-screens` / `open-save` / `recents-home`
- [x] 5. Delta `editor-shell` Welcome requirement to Create Library + attribution — change + main spec

## Manual test scenarios

1. Cold `/` — kit Welcome (hero, Create Library black, plain top-right credit); document fits viewport; no page scroll
2. Create Library → pick folder → empty library; cancel picker → still Welcome
3. Permission-required path — Allow access still works; unsupported-browser path unchanged when FSA missing
