# Future architecture notes

Deferred product architecture. Do not implement these in drive-by changes — open an OpenSpec change when the time comes.

## Book core and shared render

When the photobook editor lands (spreads, slots, print, static site publish):

- Introduce a pure `src/core/` package: serializable book JSON (`Book → Spread[] → …`), Zod schema at load boundaries, layout geometry as pure functions (no React/DOM).
- Keep browser I/O (file handles, workers, blob URLs, export) in platform/capability modules — not in core.
- Prefer one shared page/spread render path for editor, print, and site so outputs do not diverge.
- Extend dependency-cruiser with a `core-is-pure` rule (core must not import UI/React/platform) when `src/core` appears.

See also `.cursor/rules/data-model.mdc` for the target shape sketch.

## Visual regression e2e

Screenshot / `toHaveScreenshot` Playwright tests (Docker Playwright image parity, fixture photos including EXIF-rotated and low-DPI cases) are deferred until spread/export UI exists.

Tracking issue: https://github.com/Bassov/photobooks/issues/8
