## Proposal

Roadmap: `docs/roadmap/P3/derivative-tuning.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Size select UI (ships in `in-app-publish`); AVIF (`avif-encoder`, needs a dependency).
- New preset ids or edges: `site-thumb` 480 / `site-display` 1600 / `site-large` 3200 / `site-share` 1600 stay (site export and `e2e/image-derivatives.spec.ts` key on them); 2048 is measured for the ladder only.

### Delta / Risk

- Dev lab `dev/derivative-lab.html` is a build input only when `VITE_TEST_FIXTURES=1`; the deploy bundle never ships it. Fixtures are generated in the lab worker (no binaries); encode + SSIM + block ΔY run in that worker.
- Quality changes change cache ids: old derivatives regenerate (no prod users).
