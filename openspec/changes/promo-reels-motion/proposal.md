## Proposal

Roadmap: `docs/roadmap/P5/promo-reels-motion.md`. Spec SoT: Designer `promo-reels-3/spec.md` §2, §6, §7 (checks 1–8).

### Scope out

- Real reels (`ReelA|B|C.jsx`, `x.shots.js`) and final renders: promo-reel-a/b/c.
- Kit capture, photo grading (`promo/reels/**`, R0a); v1/v2 promo.
- Check 9 (manual RESULT.md): reel items.

### Delta / Risk

- Promo-only tooling: no `src/` change, no spec delta, no product tests.
- Security: new dep `@remotion/motion-blur` pinned 4.0.547 (MIT, same version as the other Remotion packages,
  lockfile integrity), `promo/motion` only, never in the product bundle.
