# Spec Delta

## ADDED Requirements

### Requirement: Smaller template announces unplaced photos

When the user chooses a template and that change removes one or more placements, the editor MUST set the polite live region to `1 photo was unplaced from the spread` for one removal, or `N photos were unplaced from the spread` for N greater than one. Removed photos MUST stay in the gallery. Choosing a template that removes no placements MUST leave that live region unchanged.

#### Scenario: Overflow placements are announced

- **WHEN** a filled spread is switched to a template with fewer slots
- **THEN** photos that still have slots stay on the spread and keep a Placed badge, overflow photos leave the spread but stay in the gallery, those filmstrip items lose Placed when they have no placement left, and the polite live region reads `1 photo was unplaced from the spread` or `N photos were unplaced from the spread` for that removal count

#### Scenario: No removals leave an earlier status

- **WHEN** the polite live region already has a message and a template change removes no placements
- **THEN** that message is unchanged

#### Scenario: Empty gallery template change

- **WHEN** the gallery is empty and the user chooses another template
- **THEN** no Placed badge is shown and the polite live region stays empty

#### Scenario: Smaller template stays on the page

- **WHEN** the user chooses a smaller template on the active spread
- **THEN** the document element does not gain horizontal or vertical page scroll
