# live-captions

Tag: feature
Milestone: M4.5
Title: captions from photo metadata

## Scope

- [ ] Caption anchored to a photo frame; template tokens `{date}`, `{title}`, `{caption}`, `{camera}`; updates when the photo is replaced; "Make static"
- **Perf:** captions re-resolve only for frames whose asset changed. Gate: swap photos across a spread with live captions — zero LoAF.
- **Browser check:** add a live caption under a photo, swap in another photo — the date and title update; make it static and swap again — it keeps its text.
- **UI ref:** `uikit#/feature/live-captions`
