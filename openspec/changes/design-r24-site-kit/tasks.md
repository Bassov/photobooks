## Implementation

- [x] 1. Deep link and Forward open on the cover without a turn; only a home tap turns it (`sys.tsx`, `room.tsx`) — `e2e/kit-personal-site.spec.ts` "direct book link" (1440, 390), `expectOpened` still green.
- [x] 2. Preview and `siteEntry=book` start on the cover; kit states naming a slide keep it (`demo-parts/site.tsx`, demo-capture comment) — `e2e/kit-personal-site-demo.spec.ts`, `e2e/kit-personal-site.spec.ts` "Spread 2".
- [x] 3. Kit qa checks and existing kit specs follow the cover start — `uikit:qa:quick` 422 passed; room / reader-gl / fold-strip / mod-arrows specs green.

## Manual test scenarios

1. 1440 × 900 and 390 × 844: `/uikit/#/full/personal-site?book=lake-trip` → label "Cover" after 1 s.
2. `#/demo` → create a book → Preview → label "Cover"; → shows "Page 1 of …".
