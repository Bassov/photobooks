# visual-regression-e2e

Tag: prep
Milestone: M2.5
Title: screenshot tests (issue #8)

Deferred by owner until the M2.5 redesign settles; screenshot baselines would churn on every redesign/feature PR.

## Scope

- [ ] Playwright Docker parity, fixtures incl. EXIF-rotated and low-DPI photos, baseline spreads
- [ ] `toHaveScreenshot` baselines for the `?specimen` page and editor empty / happy states; CI job; baseline update procedure in `docs/design.md`
