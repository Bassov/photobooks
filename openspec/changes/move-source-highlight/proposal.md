## Proposal

Prod QA bug PLC-06 (no roadmap item). Keyboard move-source frame (`aria-pressed`, “Cancel move”) shows no visible selection ring at any zoom.

### Scope out

- New selection/focus tokens beyond `--select` / `--ring`
- Pointer drop-hover ring redesign (same overflow root cause only if shared)

### Delta / Risk

- E2e: happy path — place two photos, Enter to mark move source, assert pressed ring paints (not clipped) at fit/zoomed-out levels; Escape clears. Empty: no pressed ring. No page-level H/V scroll; scrolling only inside `pasteboard-scroll`.
