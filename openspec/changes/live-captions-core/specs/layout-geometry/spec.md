## ADDED Requirements

### Requirement: Live captions

A text frame SHALL be live when its content is a template anchored (`anchorFrameId`) to an image frame of the same book spread. With a photo in the anchor, `{date}` (`capturedAt` as `D Mon YYYY`, English month table; `Z` / offset → local date; else the first `YYYY[-:]MM[-:]DD`; unparseable → empty), `{title}`, `{caption}` (no fallback to title) and `{camera}` SHALL read the photo's asset, and parts left empty after a `·` split SHALL be dropped; an anchor without a photo SHALL print `—` per photo token. `editText` SHALL keep the content type. `setTextLive` on SHALL turn the text into the template and anchor the nearest image frame (rect-to-rect mm gap, frames with a photo first, ties → lower index; no image frame → no-op); off SHALL store the resolved text and drop the anchor. `setTextAnchor` SHALL re-anchor to an image frame of the spread. After every op, an anchor that is not an image frame of its spread SHALL make the caption static with the text resolved before the op, in the same step, so `bad-text-anchor` never fires.

#### Scenario: Live caption follows the photo, then freezes

- **WHEN** a text `x` under a photo dated `2025:07:12 08:35:00` with title `Lake` becomes live and is edited to `{title} · {date} · {caption}`
- **THEN** it resolves to `Lake · 12 Jul 2025`; after `removeFrames` of the anchor it is static `Lake · 12 Jul 2025`, and undo restores the template and anchor

#### Scenario: Empty anchor and Make static

- **WHEN** a live `{date} · {camera}` is anchored to an empty image frame, then `setTextLive` off runs
- **THEN** it paints `— · —` and is stored as static `— · —` with no anchor
