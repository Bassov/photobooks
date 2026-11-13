## MODIFIED Requirements

### Requirement: Settings shell (library section live)

The Settings shell SHALL match kit settings chrome: a section nav (Library, Hosting, Site, Print presets) and a content pane. The Library section MUST show the current library folder name/path, a live book count from the library list (session `listLibraryBooks` / storage `listBooks()`), and **Change library folder…** that uses the same confirm dialog and FSA `changeLibraryFolder` path as the library bar. Cancel on confirm MUST leave the library unchanged. Hosting is the R2 credentials form (publish spec); Site is the site settings card (site-export spec). Interface has no behavior yet and MUST be hidden, not stubbed. Settings content overflow scrolls only in a named settings scrollport (`settings-scroll` / `data-scrollport="settings"`); there MUST be no page-level H/V scroll. Settings MUST NOT introduce card borders on the Library panel (chrome surface + rules only).

#### Scenario: Live book count

- **WHEN** Settings Library is open with N books in the granted library
- **THEN** the settings book count shows N (0 for an empty library), and a muted "—", never a number, while the current library's list is pending or failed

#### Scenario: Change library from Settings

- **WHEN** the user confirms Change library folder… in Settings and picks a folder successfully
- **THEN** the library binding updates the same way as Change from the library bar

#### Scenario: Deferred sections are read-only

- **WHEN** Settings opens
- **THEN** the nav lists Library, Hosting, Site and Print presets, and no Interface control (hidden, not a read-only stub)
