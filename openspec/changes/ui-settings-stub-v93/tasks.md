## Implementation

- [x] 1. Delta `editor-shell` spec: Settings opens kit shell (Library live; deferred sections read-only) — `openspec/changes/ui-settings-stub-v93/specs/editor-shell/spec.md`
- [x] 2. Add settings nav glyphs + Icon coverage — `src/ui/icons/glyphs.ts`, `Icon.test.tsx`
- [x] 3. Port `SettingsScreen` (Library live + Change confirm → FSA; deferred “coming later”) — `SettingsScreen.tsx`, `settingsScreenModel.ts` + tests
- [x] 4. Wire Library gear → Settings shell + back; remove stub dialog — `LibraryScreen.tsx`
- [x] 5. Unit + e2e (open → count → back; Change cancel/confirm; scrollport); update `docs/design.md`; tick roadmap scope

## Manual test scenarios

1. Library → Settings gear → Library section shows folder name and live book count; Back → library
2. Settings → Change library folder… → confirm → FSA picker; cancel leaves path unchanged
3. Hosting / Site / Print / Interface show coming-later copy only; no page-level scroll

OK 1. Library → Settings gear → path + count; Back → library
OK 2. Change library cancel leaves path unchanged
OK 3. Deferred sections coming-later; no page scroll
OK Perf. Open/close 0 LoAF unthrottled; under 4x cold mount only (~22ms wall), subsequent open/close 0 LoAF

## UI review

- [pass] Design system — Theme B chrome tokens + `Button`/`Icon`/`FeaturedIcon`/`Badge`/`AlertDialog`; no card borders on Library panel
- [pass] A11y — nav `aria-current`, focus-visible rings, settings-back labeled, library chrome `aria-hidden` while Settings open
- [pass] States — Change disabled when busy; deferred panes read-only; confirm cancel/confirm
- [pass] Layout smoke — e2e empty library still works; happy Settings count; `assertNamedScrollport('settings-scroll')` + `assertDocumentFitsViewport`
- [pass] Anti-slop — grayscale chrome, no purple/glow/capsule credits/folder toasts
