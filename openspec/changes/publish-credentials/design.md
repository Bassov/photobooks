## Decisions

1. `HostingSection` (new): `form` | `connected` (+ Replace, Forget confirm), from `loadHostingSummary()` only. Connect = `connectHosting`, Check again = `recheckHosting`, Forget = `forgetCredentials` (merged core). Nothing is sent on open (D9).
2. Security (D5): the secret input is uncontrolled; state keeps only `'' | 'ok' | 'bad'`. Connect reads it once, then clears it and unmounts the form. No `name`, no `<form action>`, no value in `title` / `aria-*` / `data-*`; messages are core's redacted text.
3. Other fields: `setHostingField` / `normaliseSiteAddress` / `hostingFieldError` / `validateHostingForm`. A failure shows `message` in the footer, rings `fields`, and `cors` marks help step 3.
4. Primitives: `bg-chrome` card, `bg-field` box, `Button`, `Badge`, `AlertDialog`, `Icon`, `LoaderGlyph` (+ its spin CSS). `BOX` / `ring` / `ERR` are copied: `PrintProfileDialog` keeps them private and is outside this lane.
5. Saving is async (IndexedDB + fetch): no LoAF from our code.

## Touch-set & Test Plan

| Path                                                                    | Why                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| `src/editor/settingsScreenModel.ts`                                     | hosting at index 1, checked-date text             |
| `src/editor/settingsScreenModel.test.ts`                                | sections, date text                               |
| `src/editor/SettingsScreen.tsx`                                         | render `HostingSection`                           |
| `src/editor/SettingsScreen.test.tsx`                                    | form and card states (fake IndexedDB + fetch)     |
| `src/editor/HostingSection.tsx`                                         | new UI                                            |
| `src/editor/HostingSection.test.tsx`                                    | form, connect, failures, recheck, replace, forget |
| `e2e/library-screens.spec.ts`                                           | nav count 3                                       |
| `e2e/hosting-settings.spec.ts`                                          | Spec cases (6 tests), ring paint, LoAF            |
| `openspec/specs/publish/spec.md`, `openspec/specs/editor-shell/spec.md` | archive sync                                      |
