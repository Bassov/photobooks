## MODIFIED Requirements

### Requirement: Tier object URLs stay bounded

Working-preview object URLs MUST live in a bounded cache and MUST be revoked when evicted. The system MUST publish at most one new preview object URL per animation frame. An evicted or replaced object URL that a document element still references (`src`, `srcset` or inline `style`) MUST NOT be revoked until no element references it; the cache entry still leaves at once, so the cache capacity is unchanged.

#### Scenario: Eviction revokes the URL

- **WHEN** the cache exceeds its capacity and an older preview is evicted
- **THEN** that preview's object URL is revoked

#### Scenario: A URL on screen outlives its eviction

- **WHEN** an evicted preview's object URL is still the `src` or a `srcset` candidate of a mounted image
- **THEN** the URL is not revoked while that image references it, and is revoked after the image drops it
