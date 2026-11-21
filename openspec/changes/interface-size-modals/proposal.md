## Proposal

Roadmap: `docs/roadmap/P5/interface-size-modals.md` (SoT). Design: Designer `interface-size` §4, IS5 (dialogs), IS10.

### Scope out

- Popovers and pointer maths (sibling lanes), kit, Settings UI.
- Dialog callers: they inherit the overlay root zoom.

### Delta / Risk

- Portalled overlays sit outside the `#root` zoom, so today they stay at 100 %. e2e: happy = dialog / toast s× larger, centred; empty = 100 % unchanged; interact = opened dialog on top at its centre.
