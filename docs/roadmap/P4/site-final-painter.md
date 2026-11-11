# site-final-painter

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-final-painter

## Scope

Source: Designer Spec `personal-site/spec.md` D39, "Prod changes" P1, "Tests" painter parity (Owner 2026-11-11: rework the prod personal site to the bookcase). The GL reader (`site-final-gl`) needs page faces painted on canvas 2D from prod book data.

- [ ] `src/render/pagePainter.ts`: pure `(ctx, book, page, images, pxPerMm) => Promise<void>` painting one physical page: page colour, photo frames (crop, rotation, frame look), text frames, captions, folios. Reuses `photoLayout.ts`, `frameBox.ts`, `frameLookCss.ts` values and `textStyles.ts` styles (no copies of their math). Exported; no consumer yet (`site-final-gl` wires it).
- [ ] `src/render/pagePainter.test.ts`: unit tests on a recording context.
- [ ] `e2e/page-painter.spec.ts`: 4 fixture pages (full bleed; 3 photos with crop + rotation; text frame + caption; folio), painter vs `SpreadView` screenshot at the same px/mm.
- **Done when:** on all 4 fixtures mean ΔE ≤ 2 and ≤ 1 % of pixels with ΔE > 10 outside text; text line breaks equal (DOM line boxes vs painter lines); no long task > 50 ms from painting one page at 2× on the e2e runner; spec green 10× burn-in.
- **Hard nos:** no edits outside `src/render/pagePainter*` and `e2e/page-painter.spec.ts` (`SpreadView.tsx` read only; no `src/site/**`, `uikit/**`, `src/editor/**` settings files). No backward compat.
- **Perf:** one page at 2× paints without a long task > 50 ms.
- **Browser check:** none (no UI consumer); the e2e paints the 4 fixtures next to `SpreadView`.
