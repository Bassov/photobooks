## MODIFIED Requirements

### Requirement: Saved layout templates

"Save as template" (header `+` or the button under the tiles) SHALL save the selected spread's layout under an inline-editable name. Saved layouts SHALL persist in the open library's `library.json` (every change written through the library update, the list reloaded when another library opens; without a library they last for the session), be listed under "My templates" and under "All" after the builtins with the same slot count, apply like builtins, and offer Rename / Duplicate / Delete from a tile menu. Layouts a browser kept under `localStorage` `photobooks.templates.v1` SHALL be imported once as two-page layouts into the first library opened with no templates, and the key removed after the write.

#### Scenario: Save and reload

- **WHEN** a new user (My templates 0) in a library saves spread 2–3, names it "Trip opener" and reloads
- **THEN** "My templates 1" lists "Trip opener" and "All" lists it after the builtins with its slot count

#### Scenario: Kit fixture

- **WHEN** a test build opens with `?templates=kit` on the one-page first spread
- **THEN** the tabs read "All 13" / "My templates 3"; production builds ignore the parameter
