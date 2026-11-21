# design-r42-fill-popover-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r42-fill-popover-prod
Status: done

## Scope

Design Round 42, Must M152 (Designer review `fill-book/p/review.md`, spec FB3). Prod only; the kit is the reference
(the kit half, M153, is a separate kit-lane item).

- [ ] Fill book popover text lines (row labels and values, cover note, missing-file note, limit warning) compute
      line-height 16.8 px like the kit, not the `text-xs` default 16 px; rows stay 22 px high.
- [ ] At 1440×900 with the 12-photo e2e book the popover is 231.59 ±0.5 px tall, so the buttons match the kit within
      0.5 px.
- [ ] A unit test pins the 16.8 px leading on every text line; the fill-book e2e spec checks computed line-height and
      the popover height.
- **Browser check:** `e2e/fill-book.spec.ts` at 1440×900 (computed line-height and popover box).
