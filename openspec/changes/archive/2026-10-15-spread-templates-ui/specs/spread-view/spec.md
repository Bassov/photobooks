# Spec Delta

## MODIFIED Requirements

### Requirement: One spread updates on edit

An edit that changes a single spread SHALL update only that spread's painted output.

#### Scenario: Sibling spread is unchanged

- **WHEN** two spreads are painted and only the first spread's frames change
- **THEN** the second spread's painted output does not update

#### Scenario: Template switch leaves siblings unchanged

- **WHEN** two spreads are painted and only the first spread's template changes
- **THEN** the second spread's painted output does not update

### Requirement: Pasteboard stacks spreads

The workspace SHALL stack every spread of the current book vertically in one pasteboard, centered horizontally with a gap between spreads.

#### Scenario: Session book shows its spread

- **WHEN** the user opens the app without `fixture=painter`
- **THEN** the workspace shows three spreads and does not show a placeholder sentence: the first and last are single-page with one empty frame placeholder each, and the middle is two-page with two empty frame placeholders
