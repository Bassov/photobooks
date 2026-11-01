## ADDED Requirements

### Requirement: Collapsible Photo inspector sections

With a frame selected, the inspector SHALL open on a collapsible Photo section, followed by collapsible Fit & crop and Rotate & flip sections; these three SHALL open expanded. A closed inspector section SHALL be only its 36 px title row (37 px apart). Photo SHALL show the file name, pixel size, resolution chip and "Remove from frame", or "Empty — drag a photo" for an empty frame. Collapsing Fit & crop or Rotate & flip SHALL NOT leave crop mode.

#### Scenario: Collapse the Photo section

- **WHEN** a filled frame is selected and the user presses the PHOTO title, then presses it again
- **THEN** the file name hides while FIT & CROP moves up to 37 px below PHOTO, and the second press shows the file name again

#### Scenario: Empty frame

- **WHEN** an empty frame is selected
- **THEN** the PHOTO section is open and reads "Empty — drag a photo"
