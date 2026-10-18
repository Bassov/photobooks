# Proposal

## Why

After Fit / Fit width, Add spread can leave the new spread overflowing horizontally inside `pasteboard-scroll` (narrow ~400px and desktop mid-scroll): secondary nudge skips when the box fits height but not width.

**Why now:** residual overflow after fitted Add spread is confirmed on narrow and desktop mid-scroll; this prep unblocks reliable horizontal contain before further pasteboard work.

## Scope

**In**

- Reveal containment after fitted Add spread (narrow + desktop / mid-scroll)
- Secondary-nudge gate so single-axis overflow still gets nudged into the port
- Playwright + unit locks for those paths

**Out**

- New zoom/camera modes, filmstrip layout, virtualization windowing
- Loosening contain tolerances, retries, or mutation excludes
- New scrollports

## Success criteria

- Empty: session editor with default spreads; document fits viewport; no page-level H/V scroll; pasteboard is the named scrollport.
- Happy: after Fit or Fit width, Add spread → new spread fully inside `pasteboard-scroll` under strict `spreadViewContained` on ~400px and desktop-sized viewports (incl. mid-scroll add); zoom unchanged; no document H-scroll.
- Interact/scroll: vertical scroll stays in `pasteboard-scroll`; document does not gain page-level H/V scroll.
- Unit tests kill fits-gate / horizontal-nudge regressions.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `editor-shell`: Add-spread reveal MUST bring the new spread fully into the pasteboard scrollport after fitted zoom, including when the laid-out box fits one axis but overflows the other (narrow and desktop / mid-scroll).

## Risks

- Over-nudging when the box cannot fit either axis (preserve oversized-box early-exit)
- Flaky layout settle on narrow viewports — fix product settle, do not loosen e2e helpers
- No new dependencies; no security surface
