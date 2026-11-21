# design-r34-is-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r34-is-prod
Status: done

Round 34 Musts M133, M135 (Designer parity interface-size), prod lane: `src/ui` SegmentedControl + `src/editor/FrameContextMenu`. The kit is the reference; no kit edits.

## Scope

- [ ] M133: the segmented-control keyboard focus ring is 2 px rgb(58,56,57) (#3A3839) with a 2 px offset, from the existing token (no new raw colour), instead of `--muted-foreground` rgb(83,81,82). Affects every prod segmented control.
- [ ] M135: the frame context menu opens at the pointer under interface size 125 / 150 %: the fixed anchor inside the zoomed `#root` divides clientX/Y by `uiScale()`; every other fixed anchor placed from raw clientX/Y inside `#root` gets the same fix (PR body lists each).
- [ ] An e2e check pins both, incl. a paint check of the focus ring colour.
- **Browser check:** Tab onto a segmented control at 100 % and 150 %: ring rgb(58,56,57), 2 px, offset 2; at 3840×2160 150 % right-click a frame at (2431,974): menu top-left within 1 px of (2431.5,981); 125 % same relation; 100 % unchanged.

## Done when

1. Keyboard focus (Tab) on a segmented control: outline colour rgb(58,56,57), width 2, offset 2 (computed style), at 100 % and 150 %.
2. At 3840×2160, 150 %: right-click on a frame at (2431,974) puts the menu top-left within 1 px of (2431.5,981); at 125 % the menu sits at the pointer the same way (within 1 px); at 100 % unchanged.
3. Pinned in e2e incl. a paint check of the focus ring colour.
