## Decisions

1. **Slide index.** `SiteState.spread` → `slide` (0 = cover, s ≥ 1 = doc spread s − 1). New pure `slideLabel(s, n)` (spec D5); `spreadLabel` unchanged. With no `cover` prop the viewer draws the sandbox `CoverSpread`, fitted inside the stage. `parts.tsx` Preview opens at `st.cur + 1`.
2. **Layout.** One ResizeObserver on the root feeds a pure `siteLayout(W, H)` (narrow, catalog columns, stage width; constants from spec §3–§4). `site-stage` is a fixed w × w / R grid with the slide centred. The page shadow is a separate layer over the visible page(s), so spread 0's clipped half casts none.
3. **Share.** `inline-grid` with both labels in one cell (inactive `visibility: hidden`), 2000 ms, visually hidden `role=status`.
4. **Fullscreen** stays. An optional `label` prop (default = today's text) keeps site-photographer unchanged.
5. **Tokens.** `--site-*` are kit-local, scoped to `.site` (spec §1). They are not added to `docs/design.md`, because the prod `src/site/site.css` owns them in item 2. Classes use `[var(--site-*)]` utilities, since unlayered rules would beat them. Primitives reused: kit `Button`, `BookObject`, `MiniSpread`. Skill `ui-review` runs before push.

## Touch-set & Test Plan

| File                                 | Why                                                            |
| ------------------------------------ | -------------------------------------------------------------- |
| `uikit/src/features/site-viewer.tsx` | D1–D5, layout, Share, keys                                     |
| `uikit/src/features/parts.tsx`       | Preview opens at slide `st.cur + 1`                            |
| `uikit/src/features/pages.tsx`       | `site-lightbox` variant `spread: 2` → `slide: 3` (same spread) |
| `uikit/src/index.css`                | `.site` token block, `.site-h1`, card lift                     |
| `uikit/scripts/qa.mjs`               | site walk + §3 block only (shared with #456)                   |

- Tests: kit qa covers every Done-when DOM check (walk: Share; §3 block: labels, constant rects, landscape fit, 390 px overflow). Baselines: demo-baseline capture.
