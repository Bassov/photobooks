## MODIFIED Requirements

### Requirement: Embedded book page

The room SHALL accept an embedded mode for hosts such as the editor preview: `embedded { slide, onSlide }` makes the view controlled and SHALL NOT write the URL, listen to `hashchange` or add a `window` keydown listener; its head name (`author`, else the site title) is plain text, not a link; `allBooks: false` hides "All books"; `share: false` hides Share; `renderSlide(slide, widthPx)` replaces the page paint (the CSS reader is used) on the reader and in the lightbox. All are off by default and the published site SHALL render unchanged.

#### Scenario: Embedded step

- **WHEN** an embedded room at view 0 gets Next
- **THEN** `onSlide(1)` is called, the hash and history are untouched, and ArrowRight on the window does nothing
