## Proposal

Roadmap: none (redesign prep, owner-approved off-roadmap). Done when: now/background queues + idle; cancel+re-enqueue on scroll-out; adaptive pool; one decode → 320+1280 WebP; PR before/after; filmstrip/open-save/LoAF green. No page-level H/V scroll — filmstrip scrollport only.

### Scope out

- Skeletons, copy, badges, filmstrip cosmetics
- Roadmap edits; libheif; multi-folder / non-Chromium

### Delta / Risk

- Security: workers/`postMessage`, blob URLs unchanged; AbortSignal cancels only.
- Cancel must re-enqueue on re-entry (no permanent gray; LoAF max 0).
