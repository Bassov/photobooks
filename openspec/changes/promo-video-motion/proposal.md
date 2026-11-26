## Proposal

Roadmap: `docs/roadmap/P5/promo-video-motion.md` (scope / Done when SoT); Designer spec `promo-video/spec.md`.

### Scope out

- `promo/capture.mjs` and `promo/README.md` (parallel lane).
- Product code, kit, root manifests; no spec delta.

### Delta / Risk

- Security: new source-available deps (Remotion 4.0.547, pinned) live only in `promo/motion` with their own lockfile; never bundled or shipped; render output gitignored.
