## ADDED Requirements

### Requirement: Embedded book page

The book page SHALL accept an embedded mode for hosts such as the editor preview: `embedded { slide, onSlide }` makes the slide controlled and SHALL NOT write the URL, listen to `hashchange` or add a `window` keydown listener; `allBooks: false` hides the All books link and gives its 36 px to the stage; `share: false` hides Share; `renderSlide(slide, widthPx)` replaces the slide paint on the stage and in the lightbox. All are off by default and the published site SHALL render unchanged.

#### Scenario: Embedded step

- **WHEN** an embedded book page at slide 0 gets Next
- **THEN** `onSlide(1)` is called, the hash and history are untouched, and ArrowRight on the window does nothing
