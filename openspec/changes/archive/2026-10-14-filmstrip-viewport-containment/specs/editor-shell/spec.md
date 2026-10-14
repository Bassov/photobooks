## ADDED Requirements

### Requirement: Viewport-contained shell and filmstrip scroll

The editor shell SHALL fill the viewport without creating page-level horizontal or vertical scrollbars. When the gallery is longer than the visible filmstrip, horizontal scrolling MUST occur only inside the filmstrip scrollport, not by widening the document.

#### Scenario: Long gallery does not widen the page

- **WHEN** the gallery contains far more assets than fit on screen (including after a bulk import)
- **THEN** `document.documentElement.scrollWidth` MUST NOT exceed `document.documentElement.clientWidth`, and `document.documentElement.scrollHeight` MUST NOT exceed `document.documentElement.clientHeight` at the default desktop viewport

#### Scenario: Filmstrip is the horizontal scrollport

- **WHEN** the gallery is longer than the visible filmstrip region
- **THEN** the filmstrip scroll element has `scrollWidth` greater than `clientWidth`, and changing its `scrollLeft` scrolls the gallery without requiring document horizontal scroll
