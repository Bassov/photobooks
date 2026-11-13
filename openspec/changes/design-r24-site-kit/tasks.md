## Implementation

- [x] 1. Deep link and Forward rest on the cover; only a home tap turns it (`sys.tsx`, `room.tsx`) — `e2e/kit-personal-site.spec.ts`.
- [x] 2. Preview and `siteEntry=book` start on the cover; a named slide is kept (`demo-parts/site.tsx`) — `e2e/kit-personal-site-demo.spec.ts`.
- [x] 3. Kit qa checks and existing kit specs follow the cover start — `uikit/scripts/qa.mjs`.

## Manual test scenarios

1. 1440 × 900 and 390 × 844: `/uikit/#/full/personal-site?book=lake-trip` → label "Cover" after 1 s.
2. `#/demo` → create a book → Preview → label "Cover"; → shows "Page 1 of …".
