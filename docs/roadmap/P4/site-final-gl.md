# site-final-gl

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item site-final-gl
Status: done

## Scope

Source: Designer Spec `personal-site/spec.md` D38, D39, D44, "Prod changes" P3 (Owner 2026-11-11: rework the prod personal site to the bookcase). The home and the room need the stand's WebGL book in prod, with faces from the P1 page painter (`src/render/pagePainter.ts`).

- [x] `src/site/book/gl/{three,closed,open,curl}.ts`: port the kit's `uikit/src/features/site-book/gl/*` to prod types; same geometry, curl and lighting, no new look.
- [x] three r170 vendored like the kit (`src/site/book/gl/vendor/three.module.min.js` + `LICENSE.md` copied, `.d.ts` typed for prod); no `package.json` change; imported only through a dynamic `import()`.
- [x] `src/site/book/gl/types.ts`: GL-local input (cover panels front / spine / back, page count → thickness, trim mm, paper default `#FBFAF7`, endpaper default kit `ENDPAPER`, face provider). No import of `src/site/siteInput.ts` / `siteModel.ts`.
- [x] `src/site/book/gl/faces.ts`: faces painted lazily with `pagePainter`, current view ± 2 first, grain after painting, one page per task with a yield between pages.
- [x] `budget.json`: `/site.html` script budget 200 → 400 KB (Owner Q-12 2026-11-11).
- **Done when:** unit tests green next to each file (geometry, face scheduling order, input defaults); `pnpm typecheck`, lint, knip green; a test checks the build manifest: the site entry script stays ≤ 200 KB and the GL code sits only in a lazy chunk; painting 6 faces at 2× shows no long task > 50 ms.
- **Hard nos:** no edits to `src/site/*.ts(x)`, `src/site/export/**`, `e2e/site-*.spec.ts`, `uikit/**`, `src/render/**`. No backward compat.
- **Perf:** 6 faces at 2× paint without a long task > 50 ms.
- **Browser check:** none (no UI consumer yet); `site-reader-gl.spec.ts` comes with the room item.
