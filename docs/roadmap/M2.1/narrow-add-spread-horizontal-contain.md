# narrow-add-spread-horizontal-contain

Tag: contingency
Milestone: M2.1
Title: Narrow viewport: add-spread reveal must contain horizontally

## Scope

## Goal

After Fit (or Fit width) on a ~400px-wide window, Add spread must leave the new spread fully inside `pasteboard-scroll` (strict `spreadViewContained`), with no page-level H scroll.

## Why

Manual browser pass on PR #82 review follow-up: at 400×800, Fit width zoomed to ~34% and doc had no H-scroll, but the revealed last spread still overflowed horizontally (`dr≈177`). Mid-scroll add on a desktop-sized MCP window also showed residual horizontal overflow after the vertical jump.

## Done when

- Playwright covers a narrow (~400px) fitted add-spread path with strict contain.
- Unit/mutation coverage for any new settle math stays in mutate scope (no same-diff product-logic excludes).
