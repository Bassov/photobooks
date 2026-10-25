## MODIFIED Requirements

### Requirement: Import progress and status strip

While multi-file import runs, the filmstrip status strip SHALL show progress and remain scrollable. The strip MUST show gallery photo count when non-empty or importing. Progress MAY reflect list/enqueue readiness and visible-window decode rather than requiring every gallery original to be fully decoded before import is treated as complete.

#### Scenario: Progress during import

- **WHEN** a multi-file import is running
- **THEN** progress is visible on the status strip and the filmstrip remains scrollable

### Requirement: Visible-window decode priority

Decode and thumbnail work SHALL use two lanes: **now** (mounted filmstrip window ∪ painted-spread ∪ book-used) and **background** (other gallery prefetch). Now MUST always outrank background; background MUST run only in idle time and MUST NOT starve now. Changing the visible window MUST update the now set: assets that leave now with an unfinished thumb/working job MUST have that job aborted (queued dropped; in-flight aborted where possible) and MUST be re-enqueued at now when they re-enter without a hot thumb. The gallery import batch itself MUST continue (list-first placeholders). JPEG and HEIC/HEIF assets MUST NOT be queued for background full-original decode while outside now; when such an asset enters now, decode MUST be queued at now priority ahead of start-ordered off-window work (including when the user scrolls to the filmstrip tail).

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred on the now lane over background ids

#### Scenario: Scroll-out cancels off-window decode

- **WHEN** an asset leaves the now set while its thumb decode is queued or in flight and it is not book-used
- **THEN** that job is aborted and removed from the queue

#### Scenario: Re-enter re-enqueues

- **WHEN** a previously cancelled asset re-enters the now set without a hot thumb
- **THEN** a now-lane encode is queued again

#### Scenario: Book-used outranks idle placeholders

- **WHEN** book-used assets and many unused gallery placeholders compete for thumb320 work
- **THEN** book-used ids are preferred over idle unused placeholders

#### Scenario: Off-screen JPEG or HEIC stays unqueued

- **WHEN** a JPEG or HEIC/HEIF asset is outside the now set
- **THEN** no background full-original decode is queued for it

#### Scenario: Tail scroll outranks start-ordered prefetch

- **WHEN** the user scrolls the filmstrip to near the end while earlier off-window assets remain undecoded
- **THEN** decode slots prefer the newly visible tail ids over start-ordered background work
