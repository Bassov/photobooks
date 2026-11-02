## ADDED Requirements

### Requirement: Cancelled thumb work reaches its tile

A thumb320 decode cancelled because its asset left the now set (queued, deferred, or rejected for an already-aborted signal) SHALL, when the asset is back in now without a hot thumb, decode again and publish through the original requester (import result path or tile request). A cancelled request MUST NOT block another requester for the same asset without publishing itself.

#### Scenario: Fling back and forth, then stop

- **WHEN** the user flings the filmstrip back and forth during or after a folder import and the strip stops
- **THEN** every tile in the `filmstrip-scroll` scrollport shows its thumb within 5 s (no tile stays on the placeholder)

#### Scenario: Working preview keeps the thumb retry

- **WHEN** a thumb320 retry is pending for an asset and a working-preview decode of that asset finishes
- **THEN** the thumb retry still runs when the asset is in now
