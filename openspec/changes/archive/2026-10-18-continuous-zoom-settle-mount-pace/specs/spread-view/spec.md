## ADDED Requirements

### Requirement: Paced pasteboard window expansion

When the pasteboard target mounted range grows (including after zoom-out shrinks stride), the system MUST expand the mounted window in paced steps so newly mounted spreads do not all appear in a single animation frame. Spacers MUST keep the full-stack scroll extent while expansion is in progress. The mounted window MUST grow toward covering the visible scrollport before overscan. When the stack fits the pasteboard port, paced expansion MUST finish mounting every spread after the zoom gesture ends without LoAF in that settle window.

#### Scenario: Zoom-out settle expands without a single-frame flood

- **WHEN** committed zoom shrinks the pasteboard stride so many previously off-screen spreads enter the target window
- **THEN** those spreads mount across more than one animation frame and spacers keep the full-stack scroll extent throughout

#### Scenario: Whole-book fit finishes after gesture end without LoAF

- **WHEN** the painter fixture is zoomed out until the whole stack fits in the pasteboard port, the zoom gesture ends, and paced expansion completes
- **THEN** every spread in the stack is mounted and that settle remount window records zero LoAF

## MODIFIED Requirements

### Requirement: Off-screen spreads stay unmounted

Spreads outside the near-viewport window MUST NOT be mounted. The scroll extent MUST still represent the full stack, and the mounted window MUST cover the visible scrollport while more spreads remain beyond it. While a paced expansion toward a larger target window is in progress, spreads beyond the current paced window MAY remain unmounted even if they are inside the eventual target window; spacers MUST preserve scroll extent.

#### Scenario: Mid-scroll window covers the port

- **WHEN** the user scrolls the fixture pasteboard to the middle and more spreads remain below
- **THEN** mounted spreads cover the visible scrollport and the mounted count stays below the full stack

#### Scenario: Paced expand defers overscan mounts

- **WHEN** the target window grows and paced expansion has not yet reached the full target
- **THEN** spreads outside the current paced window stay unmounted and spacers keep the full-stack scroll extent
