# Spec Delta

## ADDED Requirements

### Requirement: Filmstrip thumbnail file name

The filmstrip MUST label each thumbnail with that asset’s session file name when one is present. When no session file name is present, the thumbnail MUST be labeled with the asset id. That label MUST be the thumbnail’s accessible name. Selection and drag identity MUST remain the asset id.

#### Scenario: Cyrillic file name

- **WHEN** a gallery asset’s session metadata stores the file name `фото отпуск 01.jpg`
- **THEN** that thumbnail’s accessible name is `фото отпуск 01.jpg`

#### Scenario: Missing session file name

- **WHEN** a gallery asset has no session file name
- **THEN** that thumbnail’s accessible name is the asset id

#### Scenario: Empty gallery

- **WHEN** the gallery has no assets
- **THEN** the filmstrip shows “Add a folder or photos to build the gallery.” and shows no thumbnail

#### Scenario: Activate the named thumbnail

- **WHEN** the user activates a thumbnail whose accessible name is the imported file name
- **THEN** that thumbnail is selected, the document has no page-level scroll, and horizontal scrolling stays inside the filmstrip
