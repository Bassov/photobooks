# promo-carousel-4x5

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item promo-carousel-4x5
Status: done

## Scope

Owner 2026-11-27: the 8 feed slides (1080×1350, 4:5) keep a 6 % side margin: nothing but the background within 65 px
of the left or right edge. Stories untouched.

- [ ] Feed windows (slides 2–6) at 65, 400, 950×1040 (bottom bleed only), crops re-fit, upscale limit holds
- [ ] Slide 7 open book at 65, 340, 950×1010 in the window frame (no side bleed)
- [ ] Slide 8 tilted cover card bounding box ≤ 1015; hook title and Swipe chip ≥ 65 from the sides
- [ ] `SAFE.feed.sides` 65 and the safe check covers every feed window / card box; Stories output unchanged
- [ ] promo/README.md notes the 65 px feed side margin
- **Browser check:** `node promo/carousel.mjs --sheet` exits 0; contact sheet reviewed
