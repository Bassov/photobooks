## ADDED Requirements

### Requirement: Bookcase home

The site home SHALL show the head name (`author`, else the site title), the lead (`intro`, else `Photobooks by {author}.`, else none) and the bookcase: every published book once, as a link to its book page, on shelves laid out by the kit's shelf rules, in "Site Inter Display" on `#f4f3f0` (html, body and `theme-color`). With no books it SHALL say "No published books yet." and show no case.

#### Scenario: Home checkpoints

- **WHEN** the home opens at 1440 × 900
- **THEN** the name sits at x 24, y 20; the lead at x 141.33, y 104, 640 wide; the case at x 141.33, 1157.33 wide, 40 below the lead; every book is an `<a href>` to its book page

### Requirement: Home prerender and GL books

The prerendered case SHALL stay hidden until the first client layout, so nothing shifts after hydration. Face-out books SHALL be CSS objects that the lazily loaded GL book replaces in place after the first idle following `load`; `?gl=0` or no WebGL2 SHALL keep the CSS objects.

#### Scenario: No GL

- **WHEN** the home opens with `?gl=0`
- **THEN** every face-out book stays a CSS object and no GL canvas is drawn

## MODIFIED Requirements

### Requirement: Narrow layout

Below 768 px the book page SHALL use the narrow layout (20 px padding, Share under the meta); at ≤ 640 px the home SHALL use the phone bookcase (name at 16 / 16, lead at 16 / 72, case at 16 / 184 between 16 px margins). Neither SHALL have page-level horizontal scroll or an element past the viewport's right edge.

#### Scenario: Phone

- **WHEN** the home and a book page open at 390 × 844
- **THEN** `scrollWidth` equals `clientWidth` and no element's right edge exceeds 390
