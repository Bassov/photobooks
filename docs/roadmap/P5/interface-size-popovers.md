# interface-size-popovers

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item interface-size-popovers
Status: done

## Scope

Positioned popovers render at app scale and sit where they would at 100 % (design spec interface-size §4 first
bullet, Must IS5 popover part). Depends on interface-size-core (#668: `src/ui/uiScale.ts`, `--ui-scale`,
`#root { zoom }`).

- [x] `src/ui/Popover.tsx`, `Menu.tsx`, `Select.tsx`, `ListSelect.tsx`, `Tooltip.tsx` (+ CSS): the element React Aria
      positions stays unzoomed; its single content root gets `zoom: var(--ui-scale)` and carries the box styles (bg,
      border, radius, padding, shadow, width / min-width); `offset` / `crossOffset` × `uiScale()`.
- [x] IS5 popovers (zoom menu, sort menu, book menu, Select, Tooltip, frame context menu) at 3840×2160 and s = 1.25 /
      1.5 = R(s) ±0.5 px (R(s) = same state at 100 % in a W/s × H/s viewport, values × s): position, size, gap as at
      100 % × s, fully inside the viewport. Pinned by new `e2e/interface-size-popovers.spec.ts`.
- [x] IS10: at 100 % nothing changes; existing unit / e2e / design specs for these components pass untouched.
- Out of scope: dialogs / toasts (interface-size-modals), pointer maths and `src/editor/*` (interface-size-pointer),
  `uikit/` (interface-size-kit).
- **Browser check:** 3840×2160 with `localStorage['photobooks.ui.scale.v1']='150'`: open the zoom menu, sort menu,
  book menu, a Select, a Tooltip and the frame context menu; each sits next to its trigger with a 1.5× gap, inside
  the screen.

## Done

Shared helper `src/ui/scaledOverlay.tsx` / `.css`. The e2e measures each popover against its trigger (offset, gap,
size × s, ±0.5 px): text-sized triggers in `#root` round a few app px apart under zoom. `Select.tsx` is native (no
change). The frame menu anchor (`FrameContextMenu.tsx`, raw `clientX` inside the zoomed `#root`) still needs
÷ `uiScale()` in lane interface-size-pointer; the e2e uses a left-page frame until then.
