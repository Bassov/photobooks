## Proposal

Roadmap: `docs/roadmap/P5/interface-size-kit.md`. UI ref: `uikit#/feature/site-settings`.

### Scope out

- Kit overlays: interface-size-kit-overlays.
- Prod Settings (`src/**`): interface-size.

### Delta / Risk

- UI e2e: happy (100 %), clamp, widened stage, focus. No page-level H/V scroll; scrolling only inside the Settings main pane. `#/demo` zooms too, clamped against the window.
