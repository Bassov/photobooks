## Proposal

Roadmap: `docs/roadmap/P2/arrange-lock.md` (SoT). UI ref: `uikit#/feature/inspector`.

### Scope out

- New ops or schema: inspector ops `reorderFrame` / `setFrameLocked` are reused.
- Menu items beyond arrange + lock.

### Delta / Risk

- UI: empty = no menu until a frame is right-clicked; happy / interact = menu and shortcuts restack and lock; a locked frame keeps its box and refuses a photo drop. No page-level scroll.
- Lock key is Ctrl/Cmd+Shift+L (Ctrl+L is the address bar).
