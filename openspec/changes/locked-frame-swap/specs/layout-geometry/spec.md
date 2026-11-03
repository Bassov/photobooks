## ADDED Requirements

### Requirement: Photo ops respect locked frames

Swap, place, replace and fill ops SHALL leave a locked frame unchanged: swap with a locked frame and fill with a locked target return the same book, and fill skips locked empty frames. Swap, unplace and gallery removal SHALL change only the placement (`assetId`, `crop`, `fit`) and keep every other frame field (`locked`, `rotationDeg`, style, caption).

#### Scenario: Swap with a locked frame

- **WHEN** swap is applied between a locked filled frame and an unlocked filled frame
- **THEN** the op returns the same book; a swap between two unlocked frames keeps each frame's rotation and style
