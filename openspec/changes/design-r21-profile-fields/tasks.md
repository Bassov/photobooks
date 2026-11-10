## Implementation

- [x] 1. e2e `e2e/settings-profile-fields.spec.ts`: nav rest / hover pixels and the profile number fonts (failed first: rgb(239), Inter).
- [x] 2. M97: `bg-transparent` on the Settings nav row; unit lock-in in `SettingsScreen.test.tsx`.
- [x] 3. M98: `font-mono!` on the `field()` input in `PrintProfileDialog.tsx`.

## Manual test scenarios

1. Settings → Print presets: the Library row matches the panel grey; hover greys it; the current row keeps the accent fill.
2. Print presets → New profile: every number value is monospace at 13 px; Name stays Inter.
