## Implementation

- [x] 1. Shared `e2e/fixtures/axe.ts`: inject `axe-core` resolved via `@lhci/cli` (no new dependency); run color-contrast AA + name/role; fail on any violation; empty allowlist
- [x] 2. `e2e/a11y-contrast.spec.ts`: axe on `?specimen`, editor empty (`openSessionEditor`), happy editor (`?fixture=painter`); self-check probe fails color-contrast
- [x] 3. Darken `--muted-foreground` to `#6a6761` (tokens + uikit) so segmented/muted AA passes; no bang-excluded shell edits
- [x] 4. `pnpm check` + a11y e2e green; Manual / ui-review

## Manual test scenarios

1. OK Open `/?specimen`: token swatches and chrome read as AA-contrast; no axe failures in e2e.
2. OK Open `/` → Start session (empty editor): filmstrip/chrome labels readable; axe passes.
3. OK Open `/?fixture=painter` (happy): spreads + chrome readable; axe passes.

### ui-review

- Design system / a11y / layout smoke / anti-slop: pass (specimen, empty editor, happy painter; `--muted-foreground: #6a6761`; no page-level H scroll at 1280×800). Evidence: `/tmp/a11y-ui-review.txt`, `/tmp/a11y-manual-ok.txt`, `/tmp/a11y-only.txt` (4 passed).
