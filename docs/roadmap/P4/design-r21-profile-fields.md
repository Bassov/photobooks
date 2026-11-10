# design-r21-profile-fields

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item design-r21-profile-fields
Status: done

## Scope

- [ ] Settings nav rows (`src/editor/SettingsScreen.tsx`) are transparent at rest, so a non-current row no longer paints the native button fill rgb(239) on the rgb(225) panel (Designer printer-presets r21, M97); hover `#D7D7D7` and current `bg-accent` unchanged.
- [ ] Profile editor number values (`field()` in `src/editor/PrintProfileDialog.tsx`) render in ui-monospace 13 px like the kit, not Inter (M98). Prod only, no `uikit/` edits.
- **Browser check:** Settings → Print presets: the Library row reads as the panel grey, hover greys it; New profile: every number field is monospace.

## Done when

- e2e paint checks: non-current nav row background pixel = panel rgb(225); every number input in the profile editor has computed font-family starting ui-monospace and font-size 13 px.
- No uikit/ edits.
