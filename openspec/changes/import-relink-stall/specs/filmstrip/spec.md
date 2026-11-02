## MODIFIED Requirements

### Requirement: Import progress and status strip

While multi-file import runs, the filmstrip status strip SHALL show progress and remain scrollable. The strip MUST show gallery photo count when non-empty or importing. Progress MAY reflect list/enqueue readiness and visible-window decode rather than requiring every gallery original to be fully decoded before import is treated as complete. A failing side step (such as saving the photo folder binding) MUST NOT stop a folder import partway; when an import aborts, progress MUST clear.

#### Scenario: Progress during import

- **WHEN** a multi-file import is running
- **THEN** progress is visible on the status strip and the filmstrip remains scrollable

#### Scenario: Failed folder persist keeps the import

- **WHEN** the photo-root IndexedDB write fails during a multi-batch folder import
- **THEN** every file is attached, progress clears, no missing-assets dialog opens, and the status says to add the folder again after reload
