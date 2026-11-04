## ADDED Requirements

### Requirement: Parent guides on child spreads

While guides are shown, every book spread SHALL show the guides of its resolved parent read-only, under its own guides (order parent → local copies → own), as dashed 1 px `--parent-soft` lines with the own guides' 24 px overhang, pointer-transparent (a press reaches what is under the line), and absent from thumbs, Preview and exports. Parent guides are in two-page mm: on the first single page (right) a vertical guide `v ≥ trim width` SHALL show at `v − trim width`, on the last single page (left) only `v ≤ trim width` shows; a mapped vertical outside the spread width SHALL NOT show; horizontals show unchanged. The Masters canvas SHALL keep showing the parent's guides as editable own guides. A parent edit that changes only its guides MUST NOT repaint child spreads.

#### Scenario: Master guide on every child spread

- **WHEN** a guide is added on Master A and Pages is shown
- **THEN** every spread using Master A shows one dashed parent line at the guide's mm, a None spread shows none, and a press on the line over a frame selects that frame
