# endpaper-hires

Tag: feature
Milestone: P1
Title: Bug: /next-roadmap-item endpaper-hires

## Scope

- [ ] Endpaper canvas photo goes through the cover tier display (thumb first, then the decoded 1280 working preview); the spreads-panel endpaper rows stay on the thumb.
- [ ] The covering-tier test in `e2e/spread-view.spec.ts` samples every canvas photo surface of the painter fixture (page frame, cover front, endpaper) via `readTiers`; each surface carries `data-tier`.
- [ ] `useCoverPhotoUrl` is renamed `useThumbUrl` and stays only in inspector thumbnails; no `*Canvas.tsx` imports it.
- **Done when:** the extended spread-view test fails on the endpaper sample with the EndpaperCanvas change reverted and passes 3/3 with it.
- **Browser check:** select the endpaper of a book with a large endpaper photo → it sharpens like a page frame.
