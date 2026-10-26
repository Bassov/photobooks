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
