## Decisions

1. `layoutThumb.ts`: the kit `THUMB_RATIO = 2` constant goes; `thumbAspect` = clamp(2/3, w/h, 2), `thumbPaperBox` contains the paper in it (fills inside the clamp), `thumbColumns` = 3 below 1.2:1, else 2.
2. `TemplateThumb` sets `aspect-ratio` inline; the grid picks literal `grid-cols-3` / `grid-cols-2` (Tailwind scan), `gap-1.5`.
3. States move to the paper (hover ring + lift, selected `--select` ring, gapped `--ring` focus); the tile has no fill or focus shadow. Values: roadmap item.
4. New `--shadow-tile-hover` in `styles/tokens.css` (raw colours banned in chrome CSS); `docs/design.md` names it.

## Touch-set & Test Plan

| File                                       | Why             |
| ------------------------------------------ | --------------- |
| `src/editor/layoutThumb.ts`                | geometry        |
| `src/editor/LayoutSection.tsx`             | aspect, columns |
| `src/editor/LayoutSection.css`             | states          |
| `styles/tokens.css`                        | token           |
| `docs/design.md`                           | token           |
| `src/editor/layoutThumb.test.ts`           | unit            |
| `src/editor/LayoutSection.picker.test.tsx` | unit            |
| `e2e/design-r2-layout-picker.spec.ts`      | e2e             |
| `e2e/design-r7-panels.spec.ts`             | e2e             |
| `docs/roadmap.md`                          | title           |
| `docs/roadmap/P2/layout-tile-states.md`    | scope           |

- Unit: square, portrait clamp, landscape page, spread, past-clamp letterbox; trim change rewrites aspect + columns.
- e2e: page 1 3 columns, paper = box ±1 px; spread 2 columns, 123×61.5; hover / selected / focus paper shadows, tile bg transparent; Full bleed paper ring; empty `tpl-empty` unchanged. Skill `ui-review` before push.
