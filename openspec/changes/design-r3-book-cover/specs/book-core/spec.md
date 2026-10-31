## ADDED Requirements

### Requirement: Cover text and book size readouts match the kit

A new book's cover text SHALL be its title on the front, spine and back; the canvas SHALL draw the back text bottom-left on the back panel. The Cover inspector SHALL show Spine width as read-only text "`N` mm" from the stored width. Book settings SHALL show Pages as a read-only pill (2 × spreads) with the range hint "20–120" and the note "Add N spread(s) to reach the 20-page minimum" below 20, "Remove N spreads to stay within 120 pages" above 120, else "Pages are added in spreads of 2"; its subtitle SHALL read "`back || front || Untitled book` · applies to the whole book".

#### Scenario: New book

- **WHEN** a book "Lake trip" with 3 spreads is created
- **THEN** the back text field and canvas read "Lake trip", Spine width reads "12 mm", and Pages reads "6" · "20–120" with "Add 7 spreads to reach the 20-page minimum"
