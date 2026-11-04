## MODIFIED Requirements

### Requirement: Saved layout templates

"Save as template" (header `+` or the button under the tiles; both disabled without image frames) SHALL save the selected spread's layout under an inline-editable name (at most 60 characters) together with its page count. Saved layouts SHALL persist in the open library's `library.json` (every change written through the library update, the list reloaded when another library opens; without a library they last for the session), be listed under "My templates" and under "All" after the builtins with the same slot count only on spreads with the page count they were saved on (counts follow; a single page with none reads "No templates yet. Save a page you like."), apply like builtins, and offer Rename / Duplicate / Delete from a tile menu. Saving a layout already saved on that page count (same slot count, every slot within 0.5 percent points) SHALL add nothing, show it under My templates and flash its tile for 1200 ms. Save, rename, duplicate, delete, an existing layout and a failed library write SHALL be announced in the editor live region. Layouts a browser kept under `localStorage` `photobooks.templates.v1` SHALL be imported once as two-page layouts into the first library opened with no templates, and the key removed after the write.

#### Scenario: Save and reload

- **WHEN** a new user (My templates 0) in a library saves spread 2–3, names it "Trip opener" and reloads
- **THEN** "My templates 1" lists "Trip opener" and "All" lists it after the builtins with its slot count

#### Scenario: Kit fixture by page shape

- **WHEN** a test build opens with `?templates=kit` (three two-page layouts) on page 1, then selects spread 2–3
- **THEN** page 1 reads "All 10" / "My templates 0" and spread 2–3 "All 12" / "My templates 3"; production builds ignore the parameter
