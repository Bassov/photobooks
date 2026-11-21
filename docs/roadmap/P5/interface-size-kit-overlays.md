# interface-size-kit-overlays

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item interface-size-kit-overlays

## Scope

- [ ] Item 3 of Designer tool 6 `interface-size` (Owner Q-28), part 2 of the kit work: kit overlays follow the spec §4 portal rule so a scaled kit (`demo-root` / `demo` zoom from #677) stays right (Musts IS5 kit side, IS10). Kit-only; mirrors prod `src/ui/scaledOverlay.tsx`.
- [ ] `uikit/src/components/ui/{popover,menu,select,tooltip}.tsx`: at s ≠ 1 the element React Aria positions stays unzoomed; its single content root gets `zoom: s` and the box (bg, radius, shadow, hairline, consumer classes); `offset` / `crossOffset` / `containerPadding` × s; `--trigger-width` widths divide back by s.
- [ ] `uikit/src/components/ui/{dialog,toast}.tsx`: the modal overlay root and the toast region get `zoom: s`. The scale comes from the kit session (`UiScaleCtx`, D4 clamp) through one small hook file.
- **Done when:** `e2e/kit-interface-size.spec.ts` at 1920×1080 (125 effective) measures the kit Create book dialog, its Page size Select, an editor tooltip and the library book menu = 100 % values × 1.25 (±0.5), Select as wide as its trigger, menu right edge on its trigger as at 100 %, gaps × 1.25; at 100 % nothing in the kit changes (IS10): existing kit e2e and demo baselines pass untouched; `pnpm roadmap check` green.
- **Browser check:** `/uikit/#/demo` at 1920×1080 → Settings → Interface → 125% → Library → book "…" menu and New book dialog are 1.25× bigger and stay on their triggers.
- **Hard nos:** prod `src/**`, `uikit/scripts/qa.mjs`, `uikit/scripts/demo-capture.mjs`, `uikit/src/features/pages.tsx`, `uikit/src/sandbox/**`, `uikit/src/index.css`, `uikit/src/demo-parts/editor.tsx`, `styles/tokens.css`; no new demo step or baseline.
- **Test:** `e2e/kit-interface-size.spec.ts` (extended).
- **Depends:** interface-size-kit.
