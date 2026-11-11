## Implementation

- [x] 1. Vendor three r170 (`vendor/`), typed `.d.ts`, `.prettierignore`; `three.ts` loader + shared renderer with tests.
- [x] 2. `types.ts` + `canvas.ts`: GL input, defaults, views / faces mapping, grain; tests.
- [x] 3. `closed.ts`: closed book from cover panels; tests on geometry, poses, camera, baked shadow.
- [x] 4. `open.ts`: open book with faces from the input; tests on meshes per (a, θ), pruning, face mapping.
- [x] 5. `curl.ts`: page curl over GL-local sheets; tests on sheets and uniforms.
- [x] 6. `faces.ts`: lazy face painting with `paintPage`, view ± 2 first, yields; tests on order and grain.
- [x] 7. `budget.json` 200 → 400; `e2e/gl-faces-probe.spec.ts` (long tasks, site manifest).

## Manual test scenarios

N/A: no UI consumer yet (the room item adds `site-reader-gl.spec.ts`).
