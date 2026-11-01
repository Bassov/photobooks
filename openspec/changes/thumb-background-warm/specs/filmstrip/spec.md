## MODIFIED Requirements

### Requirement: Visible-window decode priority

Decode and thumbnail work SHALL use two lanes: **now** (mounted filmstrip window ∪ painted-spread ∪ book-used) and **background** (other gallery prefetch). Now MUST always outrank background; background MUST run only in idle time and MUST NOT starve now. Changing the visible window MUST update the now set: when an asset leaves now, its queued thumb/working jobs MUST be dropped, an in-flight working-preview (1280) job MUST be aborted, and an in-flight thumb320 job MUST run to completion with its result published and stored. A dropped or aborted asset MUST be re-enqueued at now when it re-enters without a hot thumb. A decode slot whose job was aborted MUST stay busy until its worker replies for that request, so no job is ever posted to a worker that is still decoding. The gallery import batch itself MUST continue (list-first placeholders). While the filmstrip scrolls, the now set MUST update at most every ~100 ms (not only after scroll-quiet), with the window extended in the scroll direction by the current velocity; the exact window is published once scrolling stops. After import, a background warm lane SHALL encode thumb320 (JPEG and HEIC/HEIF included) for every identity-complete gallery asset without a stored thumb, ordered book-used first, then by distance from the filmstrip window with the scroll direction first; it runs only in idle, with one slot while the filmstrip scrolls or a canvas gesture is active and the idle cap (with longtask / memory backoff) otherwise. A failed encode (e.g. unsupported HEIC) MUST NOT be retried by the lane. When a JPEG or HEIC/HEIF asset enters now, decode MUST be queued at now priority ahead of off-window work (including when the user scrolls to the filmstrip tail).

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

#### Scenario: Idle folder warms every thumb

- **WHEN** a folder of JPEGs is imported and the filmstrip is left untouched
- **THEN** every JPEG gets a thumb320 stored in DerivedCache, and an unsupported HEIC keeps its placeholder without retries

#### Scenario: Now set follows a running scroll

- **WHEN** the filmstrip keeps scrolling longer than the throttle interval
- **THEN** the now set is updated before scrolling stops, extended ahead in the scroll direction

#### Scenario: Tail scroll outranks start-ordered prefetch

- **WHEN** the user scrolls the filmstrip to near the end while earlier off-window assets remain undecoded
- **THEN** decode slots prefer the newly visible tail ids over start-ordered background work
