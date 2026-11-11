## Decisions

1. Input is GL-local (`types.ts`, `glBook()` resolves cm and defaults); views and thickness count the two endpapers as the kit does (comments in code).
2. Port, not redesign: kit constants, geometry, shaders, lights. Cover = front panel + kit hinge shade, spine = spine panel, back board = back panel; the curl takes GL-local sheets.
3. Vendored: `three.module.min.js` byte-identical to the kit; `.d.ts` authored with real types (strict lint bans `any`); `LICENSE.md` copied. Unit tests run the real three scene graph with a fake renderer.
4. Security: pinned r170, unmodified, MIT notice kept; loaded by a same-origin dynamic `import()`; no new dependency, lockfile change, eval or remote load.
5. Faces on the main thread: textures upload there; one page per task with yields; the e2e long-task probe guards it.
6. Budgets: the `site` entry stays ≤ 200 KB gzip (D44, e2e); the Lighthouse `/site.html` budget goes to 400 because the three chunk loads on the first idle after `load` (Owner Q-12).

## Touch-set & Test Plan

| File                                            | Why                                 |
| ----------------------------------------------- | ----------------------------------- |
| `src/site/book/gl/types.ts`                     | input, defaults                     |
| `src/site/book/gl/canvas.ts`                    | canvas, grain                       |
| `src/site/book/gl/three.ts`                     | loader, renderer                    |
| `src/site/book/gl/closed.ts`                    | closed book                         |
| `src/site/book/gl/open.ts`                      | open book                           |
| `src/site/book/gl/curl.ts`                      | page curl                           |
| `src/site/book/gl/faces.ts`                     | face painting                       |
| `src/site/book/gl/vendor/three.module.min.js`   | vendored r170                       |
| `src/site/book/gl/vendor/three.module.min.d.ts` | typed subset                        |
| `src/site/book/gl/vendor/LICENSE.md`            | MIT notice                          |
| `src/site/book/gl/testing.test-helpers.ts`      | fake 2D context                     |
| `budget.json`                                   | gate looser by Owner decision       |
| `quality/gates.json`                            | mirrors `budget.json` (gate-values) |
| `knip.json`                                     | ignore the typed vendor `.d.ts`     |
| `.prettierignore`                               | keep the vendored js byte-identical |
| `e2e/gl-faces-probe.spec.ts`                    | long tasks, site manifest           |

- Reuse: `paintPage`, `pagesOf`, the harness build of `e2e/page-painter.spec.ts`.
- Unit `*.test.ts` per file: defaults / views, poses and camera, meshes per (a, θ), curl uniforms, paint order and yields, grain. e2e: 6 faces at 2× → no long task > 50 ms; the site entry ≤ 200 KB gzip with no GL module.
