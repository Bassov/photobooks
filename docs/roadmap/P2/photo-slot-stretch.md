# photo-slot-stretch

Tag: feature
Milestone: P2
Title: Bug: a photo in a frame is stretched instead of cover-cropped

## Scope

- [ ] A placed photo keeps its aspect ratio (cover-crop + user crop) on every SpreadView path (canvas, Pages thumbs, Masters, cover, Presentation), for portrait / landscape / EXIF 6–8 sources and every tier (thumb 320, preview 1280) — also before its session dims are known (placeholder aspect 1 after reload or list-first import).
- [ ] The frame image never distorts when its box and bitmap aspects disagree (cover, not stretch).
- **Done when:** a test that fails on `origin/main` shows a portrait and an EXIF-6 photo in a landscape and a portrait frame render at the source aspect (±1 %: image box vs `naturalWidth/naturalHeight`), including after a thumb → preview tier swap and after replacing the photo in a filled frame; unit + affected e2e green; perf gates green, `PERF_BUDGETS` unchanged.
- **Browser check:** reopen a book with a portrait photo placed on page 3 → the photo is not stretched at any moment, before and after it sharpens.
