## Proposal

Roadmap: `docs/roadmap/M3/ui-panels.md` · UI ref: `uikit#/feature/ui-panels`.

### Scope out

- Collapsed rail (collapse reuses the existing hide state; reopen via top-bar toggles / hotkeys).
- Resizable bottom dock (already resizable in filmstrip); real inspector content.

### Delta / Risk

- Left/right panel widths drag/keyboard-resizable (min 150 / max 360), persisted in `localStorage`; bad stored values fall back to defaults. No new dependency; no security surface beyond reading a clamped number from storage.
- UI observables for e2e: empty/happy = default 212 / 300 px; interact = ArrowRight on the splitter widens the panel and a reload keeps it; Enter collapses. No page-level H/V scroll; scrolling stays in `spreads-list` / `inspector`.
