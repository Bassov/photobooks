# Proposal

## Problem

Placed photos stay soft on zoom. Each frame shows one preview, and the gesture only scales that bitmap.

## Why now

Next M1 checkbox after `camera-zoom-pan`. Zoom commits after settle, and the photo worker already resizes.

## Scope in

- One subsystem: an in-memory zoom-tier cache. A placed image uses the smallest preview whose long edge covers on-screen size times device pixel ratio
- Tiers: 320, 640, 1280, 2560 px. If none covers, use 2560. Originals never enter the DOM
- The photo worker encodes the tier. Object URLs live in a bounded LRU, revoked on eviction, at most one new URL per frame
- During a zoom or pan gesture the current image only scales. After settle, the next tier is decoded with `img.decode()` then swapped, with no placeholder flash
- Zoom-tier jobs rank below visible filmstrip thumbnails and above prefetch. Cancelling a tier must not abort an import
- Session files stay in memory for import and the painter fixture
- Perf: continuous zoom with tier switches — zero LoAF, wheel-handler p95 within budget

## Scope out

- Far-zoom LOD bitmaps (`far-zoom-lod`)
- OPFS `DerivedCache`, crop-in-frame, drag place, and new UI regions

## Capabilities

### New Capabilities

- `image-tiers`: covering-tier choice, bounded object-URL cache, worker encode, decode-then-swap

### Modified Capabilities

- `spread-view`: placed frames show the covering tier after the camera settles; empty frames stay placeholders
- `frame-budget`: continuous zoom includes tier switches

## Success criteria

- Empty: an empty frame stays a placeholder with no image, including on the painter fixture's first frame
- Happy path: after zoom settles on a placed photo, the frame's tier covers the on-screen size, and the previous image stays until the next one has decoded
- Interact: zoom the painter fixture from the whole book to a photo and back; the tier changes after settle, images do not flash empty, and the pasteboard remains the only scrollport (no page-level horizontal or vertical scroll)
- The zoom scenario records zero LoAF and wheel-handler p95 within budget

## Risks

- A 2560 px `img.decode()` under CPU throttling can record a long animation frame. Swaps stay one image per frame; the ladder stops at 2560
- Security: session files and preview bytes go only to the existing same-origin photo worker; object URLs are revoked on eviction; files are not stored in the document
