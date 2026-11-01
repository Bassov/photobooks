# cover-hires

Tag: feature
Milestone: P1
Title: Bug: /next-roadmap-item cover-hires

## Scope

- [x] Cover front photo (editor canvas + Preview) goes through the page-frame tier display: thumb first, then the decoded 1280 working preview.
- [x] Library book card cover uses the cached 1280 working preview, falling back to the thumb.
- **Done when:** `e2e/cover-hires.spec.ts` shows the cover image at the page frame's natural width and the library tile at the 1280 width; both fail on `origin/main`.
- **Browser check:** drop a large photo on the cover → it sharpens like a page frame; back to the library → the tile cover is sharp.
