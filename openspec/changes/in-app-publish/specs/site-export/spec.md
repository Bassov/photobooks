## MODIFIED Requirements

### Requirement: Export site from the editor

The editor top bar SHALL show an "Export site" pill (after Settings, before Publish) that opens a dialog (Options → Running → Done / Failed) and writes the site into `<chosen folder>/dist/` through the export worker. Export SHALL freeze the open book with `publishBook` at the moment Export is pressed (library-backed: `library.json` and `published.json` saved) and export it with the other published revisions, with web derivatives of every shown photo (a photo without `contentHash` is hashed from its source bytes during the run); edits made during the run go into the next export. One export runs at a time, and Export site is disabled while Publish runs; the running dialog can be hidden (Hide, Esc, outside click) and the pill then shows `NN%` over a fill, "Exported" for 4 s, or "Failed" until opened. The pill keeps the width of its rest content in every state (icon-only below 1360 px), its accessible name stays "Export site", and a status region announces progress at most every 10 %. The chosen folder handle SHALL be remembered per library in the session IndexedDB and readwrite permission re-requested on Export. Nothing is uploaded.

#### Scenario: Export while editing

- **WHEN** the user picks a folder, presses Export, hides the dialog and drags a frame while the export runs
- **THEN** `dist/index.html` is written with only published books, `dist/assets/` holds a file for every placed photo (also photos with no `contentHash`), the pill rect is the same in idle, running and done, and the drag has no long animation frame from our code

#### Scenario: Export again

- **WHEN** the same unchanged book is exported twice into the same folder
- **THEN** the second `dist/` is byte-identical to the first

#### Scenario: Foreign dist

- **WHEN** the chosen folder holds a `dist/` that is not a Photobooks export
- **THEN** the dialog shows the "isn't a Photobooks export" text, its primary action goes back to choosing a folder, and the foreign `dist/` is unchanged
