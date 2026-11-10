## Proposal

Roadmap: `docs/roadmap/P4/design-r21-presets-actions.md`. UI ref: `uikit#/demo` Settings → Print presets.

### Scope out

- `uikit/`, `SettingsScreen.tsx`, `PrintProfileDialog.tsx` (sibling round-21 items).
- The shared `Dialog` frame outside the alert variant.

### Delta / Risk

- Shared `AlertDialog` (every confirm gains the trash tile unless it passes `icon`) and `Badge` (no ring) change app-wide. Observables: hover pixel, opened delete confirm, badge edge pixel.
