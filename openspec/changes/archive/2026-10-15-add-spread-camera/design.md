# Design

## Context

See proposal.md. `Pasteboard` flags a reveal, then on the next `spreadIds` change assigns `scrollTop = scrollHeight` and clears the flag. The virtual window is still the previous scroll, so the new last slot may not be mounted yet. That assignment is the early jump. Committed zoom lives in the camera store; layout scale `1` reads as 13% on the indicator. Page role (new last spread one page, previous last spread two pages) stays in layout geometry.

## Goals / Non-Goals

**Goals:**

- Keep the committed zoom across Add spread.
- Scroll the new spread into `pasteboard-scroll` only after that slot has layout.
- Lock the behavior in Playwright.

**Non-Goals:**

- Changing page-role widths, camera gesture math, or zoom limits.
- A new scrollport or a new module.

## Decisions

1. **Failing e2e first.** Extend `e2e/spread-view.spec.ts`. Reuse `assertDocumentFitsViewport` and `assertNamedScrollport` on `pasteboard-scroll`. `readSpreadSlots` may supply width and placeholders; its `inScrollport` overlap flag is not proof the new spread lies inside the port. Fit spread, record the zoom percent and the previous last spread's on-screen height, Add spread. Assert the percent is unchanged, that height is unchanged while the spread becomes two pages wide, and the new one-page `spread-view` box is contained by `pasteboard-scroll` (about 1 px). The slot padding is the inter-spread gap; fit spread sizes the spread to the port, so that padding can extend past the port while the spread itself lies inside. The document must not scroll. This test must fail on current code before the fix.

2. **Reveal from the laid-out slot, not from `scrollHeight`.** `Pasteboard` keeps the reveal on the appended spread id. It moves the tracked scroll to the end of the stack using the existing stride at the committed zoom so the last index mounts. A layout effect then sets `scrollTop` from that slot's position inside the scroll content. It must not read `scrollHeight` until that slot has a box. Add spread must not call `commitZoom` or `placeZoom`.

3. **Zoom reset is conditional.** If that e2e shows the indicator back at 13%, remove the write that returns zoom to layout scale (still inside `Pasteboard` or `usePasteboardCamera` — do not add a third owner). If the percent holds, leave camera math alone and fix only the jump. The previous spread growing to two pages is not a zoom bug.

4. **Boundaries.** `Pasteboard` owns the reveal. The camera store remains the only committed zoom. `pasteboardWindow` stays the window function. Replace the `SpreadTemplateBar` test that stubs `scrollHeight` and expects `scrollTop === 900`; assert committed zoom is unchanged and the reveal does not use that stub before the new slot exists. Public surface under test: `Pasteboard`, the zoom indicator, and pasteboard slots.

## Touch-set

- `src/editor/Pasteboard.tsx`
- `src/editor/SpreadTemplateBar.test.tsx`
- `e2e/spread-view.spec.ts`
- `src/editor/usePasteboardCamera.ts` only if the e2e shows a zoom reset to 13%
- `docs/roadmap.md` — tick the existing `add-spread-camera` line at archive

## Risks / Trade-offs

- [Early `scrollHeight` looks like a zoom reset] → the failing e2e separates the two; do not "fix" page-role width.
- [Virtual window omits the new slot] → scroll the tracked position to the stride end first, then align to the slot after layout.
- [jsdom has no real layout] → geometry lock is Playwright; the component test checks zoom and that the stubbed `scrollHeight` is not applied early.

## UI verification

Empty: existing normal visit (three empty spreads, layout-scale indicator, `assertDocumentFitsViewport`). Happy: Fit spread then Add spread, percent and previous height held, new spread in the port. Interact: that add scrolls only inside `pasteboard-scroll`. Skill `ui-review`, including layout smoke, runs before push.

## Open Questions

None. The e2e chooses the mechanism; the spec outcome does not change.
