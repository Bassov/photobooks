## MODIFIED Requirements

### Requirement: Progressive reveal and import pacing

Progressive reveal MUST NOT lag `scrollLeft` into a mid-scroll dead zone of unrevealed in-range content. Mid-import mounts MUST stay within frame-budget gates without freezing the gallery id list solely to pass LoAF. Once a gallery id has been flushed into the filmstrip, scrolling during continued import MUST NOT permanently drop that tile from the gallery or leave it unrestorable when it re-enters the virtual window (in-session thumb bytes MAY republish after LRU eviction before `contentHash` exists).

#### Scenario: Mid-scroll reveal and mid-import scroll

- **WHEN** the user scrolls during or after progressive import with more items remaining
- **THEN** in-range content is revealed without a large dead zone, and newly enqueued ids continue to appear under frame-budget pacing

#### Scenario: Revealed tiles survive scroll during import

- **WHEN** assets have been flushed into the gallery and shown in the filmstrip window, then the user scrolls away and back while import is still running
- **THEN** those asset ids remain in the gallery and their tiles remount with a thumb or placeholder that recovers (not a permanent hole)
