# narrow-add-spread-horizontal-contain

Tag: prep
Milestone: M2.1
Title: Add-spread reveal must contain horizontally (narrow and desktop)

## Scope

- [ ] After Fit / Fit width, Add spread leaves the new spread fully inside `pasteboard-scroll` under strict `spreadViewContained` on a ~400px-wide window and on a desktop-sized window (manual mid-scroll add showed residual `dr≈85` after the vertical jump — not only the 400px case)
- [ ] Verify and fix the secondary-nudge gate in `revealLaidOutSpread`: today further horizontal nudges run only when `after.width <= port.width + 1` (`pasteboardReveal.ts` fits check); a box that fits height but still overflows horizontally must still be nudged into the port (and the same for the symmetric tall/narrow case if it applies)
- [ ] Lock with Playwright: narrow (~400px) fitted add-spread path and a desktop (or default e2e) fitted / mid-scroll add-spread path, both with strict contain and no page-level H scroll; keep settle math in mutate scope (no same-diff product-logic Stryker excludes)
- **Done when:** strict `spreadViewContained` after fitted Add spread is green for both ~400px and desktop-sized viewports (including mid-scroll add), with no document H-scroll, and unit coverage kills the fits-gate / horizontal-nudge regressions
