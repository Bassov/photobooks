# Proposal

## Problem

Every mounted spread subscribes to the raw gallery asset id and the raw move source. Changing which photo is selected, or moving the source between frames on another spread, re-renders spreads whose frame labels did not change.

## Why now

Prep after `drag-swap-unplace`. Later pasteboard work mounts many spreads, so a selection change must not wake spreads whose labels stay the same.

## Scope in

- A mounted spread re-renders for selection only when its own frame labels change.
- Visible labels stay as they are: Place or Replace while a gallery photo is selected; Cancel move on the source frame; Swap or Move on the other frames while a source exists.
- Changing which gallery photo is selected, while one stays selected, does not re-render a spread.
- Moving the move source between frames on another spread does not re-render this spread.
- Setting a source, clearing it, and moving the source onto this spread do re-render this spread.
- After `drag-swap-unplace` in `docs/roadmap.md`, add only the `selection-render-scope` checkbox and tick it when this change is archived.

## Scope out

- New UI, new scrollports, and any change to place, replace, swap, move, or unplace behavior.
- Filmstrip selection rendering, camera, image tiers, and mutation-scope tooling from other branches.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `spread-view`: a spread re-renders on selection only when its own frame labels change

## Success criteria

- With two spreads mounted, changing which gallery photo is selected, while a photo stays selected, does not increase either spread's render count.
- Changing the source frame on the other spread does not increase this spread's render count.
- Setting a source, clearing it, and moving the source onto this spread each increase this spread's render count.
- Visible labels remain Place/Replace, Cancel move, and Swap/Move.

## Risks

- A selection snapshot that is a new object on every read would still re-render every mounted spread.
- Gallery selection and the move source clear each other, so a test that changes one can accidentally change the other and hide a missed re-render.
