## MODIFIED Requirements

### Requirement: Settings shell (library section live)

The Settings shell SHALL match kit settings chrome: a section nav (Library, Hosting, Site, Print presets, Interface) and a content pane. The Library section MUST show the current library folder name/path, a live book count from the library list (session `listLibraryBooks` / storage `listBooks()`), and **Change library folder…** that uses the same confirm dialog and FSA `changeLibraryFolder` path as the library bar. Cancel on confirm MUST leave the library unchanged. Hosting, Site, Print presets, and Interface MUST be read-only “coming later” copy with no fake editable inputs. Settings content overflow scrolls only in a named settings scrollport (`settings-scroll` / `data-scrollport="settings"`); there MUST be no page-level H/V scroll. Settings MUST NOT introduce card borders on the Library panel (chrome surface + rules only).

#### Scenario: Live book count

- **WHEN** Settings Library is open with N books in the granted library
- **THEN** the settings book count shows N (0 for an empty library), and a muted "—", never a number, while the current library's list is pending or failed

#### Scenario: Change library from Settings

- **WHEN** the user confirms Change library folder… in Settings and picks a folder successfully
- **THEN** the library binding updates the same way as Change from the library bar

#### Scenario: Deferred sections are read-only

- **WHEN** the user opens Hosting, Site, Print presets, or Interface
- **THEN** the pane shows coming-later copy without controls that look editable
