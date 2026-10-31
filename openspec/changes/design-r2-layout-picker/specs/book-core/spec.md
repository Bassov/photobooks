## ADDED Requirements

### Requirement: Spread master and background

A spread MAY store `masterId` (`A`, `B` or `none`; absent means Master A) and `backgroundColor` (sRGB hex; absent means the book page colour). Setting Master A or clearing the colour SHALL remove the field. Each change MUST be one history step touching only that spread. Parse MUST refuse an unknown master id.

#### Scenario: Master round-trip

- **WHEN** spread 1 is set to Master B, then None, then Master A
- **THEN** it stores `B`, then `none`, then no `masterId`, and other spreads are unchanged
