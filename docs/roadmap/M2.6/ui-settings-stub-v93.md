# ui-settings-stub-v93

Tag: feature
Milestone: M2.6
Title: Port Settings stub from kit v0.9.3

## Scope

- [x] Port Settings stub from kit (library path, Change library folder…, quiet sections for hosting/site/print later)
- [x] Wire Change library folder confirm → picker to existing session/library APIs
- [x] No fake selected Binding/Material controls; read-only / coming-later where kit says so
- **UI kit:** `uikit/src/features/library.tsx` / screen-demos Settings, `UI ref: uikit#/screen/settings`, `UI ref: uikit#/demo` (settings stage)
- **Browser check:** Settings opens from library; Change library folder confirms then picks; cancel leaves path unchanged
- **Perf:** Settings is a light overlay/page; open/close no LoAF
- **Size:** ~400–800 changed lines
- **Source:** Owner package H
