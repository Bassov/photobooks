# qa-preview-cover

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item qa-preview-cover

Fixes QA-3 of the prod QA report (`docs/qa/prod-qa-2026-11-25.md`): Preview opens on a closed book with plain cloth and the title only, without the cover photo the editor shows. The guide says Preview shows the book as the published site does.

## Scope

- [ ] Preview's room entry carries the editor's cover working-preview URL as its cover (`src/editor/SitePreview.tsx`, today `cover: null`), so the closed book in Preview shows the Front photo like the published site. Every caller that builds a room entry for preview is checked (`cover: null`); the PR body lists each.
- [ ] e2e: place a photo on Front, open Preview → the room's closed book has `.cover-front-photo` with a loaded image that paints (pixel probe); `e2e/design-r7-panels.spec.ts` and `e2e/cover-hires.spec.ts` pass unchanged.
- **Browser check:** open a book, put a photo on Front, press Preview: the closed book shows the photo; with no Front photo it stays cloth + title.
