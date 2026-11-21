## Proposal

Roadmap: `docs/roadmap/P5/photo-pick-kit.md` (scope / Done when / Browser SoT); Designer spec `frame-context-menu` "Pick mode".

### Scope out

- Prod pick mode and menu rows (FM4 `photo-pick`, FM3).
- Demo shots of the empty / set / page menus.

### Delta / Risk

- UI observables (tag, ring + status, click / Enter pick, Esc / outside cancel, locked rows) are pinned by the Done when and `e2e/kit-photo-pick.spec.ts`. Kit-only; no security surface.
