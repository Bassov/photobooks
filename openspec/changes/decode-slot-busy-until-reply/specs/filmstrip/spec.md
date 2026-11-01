## MODIFIED Requirements

### Requirement: Visible-window decode priority

Decode and thumbnail work SHALL use two lanes: **now** (mounted filmstrip window ∪ painted-spread ∪ book-used) and **background** (other gallery prefetch). Now MUST always outrank background; background MUST run only in idle time and MUST NOT starve now. Changing the visible window MUST update the now set: when an asset leaves now, its queued thumb/working jobs MUST be dropped, an in-flight working-preview (1280) job MUST be aborted, and an in-flight thumb320 job MUST run to completion with its result published and stored. A dropped or aborted asset MUST be re-enqueued at now when it re-enters without a hot thumb. A decode slot whose job was aborted MUST stay busy until its worker replies for that request, so no job is ever posted to a worker that is still decoding. The gallery import batch itself MUST continue (list-first placeholders). JPEG and HEIC/HEIF assets MUST NOT be queued for background full-original decode while outside now; when such an asset enters now, decode MUST be queued at now priority ahead of start-ordered off-window work (including when the user scrolls to the filmstrip tail).

#### Scenario: Scrolling promotes newly visible tiles

- **WHEN** the filmstrip window scrolls so new asset ids enter the mounted window while background thumbs are still queued
- **THEN** those newly visible asset ids are preferred on the now lane over background ids

#### Scenario: Scroll-out drops queued decode

- **WHEN** an asset leaves the now set while its thumb decode is queued and it is not book-used
- **THEN** that job is aborted and removed from the queue

#### Scenario: Scroll-out keeps an in-flight thumb

- **WHEN** an asset leaves the now set while its thumb320 decode is already running on a worker
- **THEN** that decode finishes and its thumb is published and stored

#### Scenario: Aborted slot waits for the worker

- **WHEN** an in-flight decode is aborted
- **THEN** its slot takes no new job until the worker replies for the aborted request

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
