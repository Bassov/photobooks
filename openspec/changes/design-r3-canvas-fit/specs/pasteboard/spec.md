## MODIFIED Requirements

### Requirement: Camera zoom controls

Keyboard-reachable fit spread, fit width, and 100% physical size (96 CSS px/inch) plus a percent indicator. Fit spread SHALL size the book's widest spread (two pages; kit `viewport.tsx` `SW`) into the port, so every spread of the book, single pages included, fits at the same Fit zoom and the indicator reads "Fit" on each. Changing the active spread MUST keep the committed zoom; after a manual zoom the indicator shows the percent, not "Fit". Controls MUST NOT create page-level H/V scroll.

#### Scenario: Fit and 100%

- **WHEN** the user chooses 100%, fit width, or fit spread
- **THEN** sizing matches physical size / port width / port fit respectively and the document has no page scroll

#### Scenario: Fit follows the active spread

- **WHEN** at Fit the user selects page 1, then spread 2–3, then the last page in the spreads list
- **THEN** each active spread lies inside the pasteboard and the indicator reads "Fit"
