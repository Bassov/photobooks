# deps-dev-outline-longhands

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item deps-dev-outline-longhands

## Scope

- [x] Land Dependabot #643 (dev group, 12 updates incl. `@playwright/test` / `playwright-core` 1.65.1); lockfile equals the dependabot one.
- [x] Chromium 159 serializes the `outline` shorthand as `2px solid <color>`: replace the shorthand `toHaveCSS('outline', …)` asserts in `e2e/layout-grids-parent-inherit.spec.ts` and `e2e/parent-spreads-inspector.spec.ts` with `outline-style` / `outline-width` / `outline-color` longhands.
- [x] Grep `e2e/` and `uikit/` for other `outline` / `border` shorthand asserts; fix them the same way or list them in the PR with a reason.
- No product source change.
- **Browser check:** n/a (test-only; CI `e2e` on Chromium 159).
