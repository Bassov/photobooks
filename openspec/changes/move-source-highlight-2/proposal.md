## Proposal

Prod QA bug PLC-06 still failing after #181 (no roadmap item). Keyboard move-source (`aria-pressed`, “Cancel move”) paints a visible ring only near 168% zoom; at 13–100% move-active vs cancelled screenshots are pixel-identical. Ring must stay screen-visible above the photo at every settled zoom.

### Scope out

- Drop-hover ring redesign (unless same under-image paint)
- New selection tokens beyond `--select` / `--ring`
- Live pinch-transform transient scaling

### Delta / Risk

- E2e: place two photos, Enter move-source, assert pressed frame pixels differ from cancelled at ~13% and ~100% (not only CSS classes). Empty: no ring. No page-level H/V scroll; only `pasteboard-scroll`.
