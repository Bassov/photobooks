# Proposal

## Problem

Applying a smaller template drops overflow placements. Those photos stay in the gallery and the Placed badge clears, but nothing is announced.

## Why now

Next M1 item after `drag-swap-unplace`. Index rebind already drops unused frame ids; the missing piece is a polite count.

## Scope in

- The chosen template still applies. Overflow placements are removed. Those photos stay in the gallery.
- When at least one placement is removed, the existing polite editor status says how many. Copy is `1 photo was unplaced from the spread` or `N photos were unplaced from the spread`.
- When zero placements are removed, the editor status stays as it was.
- Placed badges follow remaining placements.

## Scope out

- Changing index rebind, crop, or which asset ids keep a slot
- Undo, a new status channel, and any new scrollport

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `editor-shell`: a template change that removes placements announces the count; a change that removes none leaves the status unchanged

## Success criteria

- Empty: a template change that removes no placements leaves the polite status unchanged (still empty if it started empty, or still the earlier message if one was set), and an empty gallery shows no Placed badge
- Happy path: shrinking a filled spread keeps photos that still have slots, removes the overflow placements, keeps those photos in the gallery, clears Placed on photos with no placement left, and the live region reads the count sentence above
- Interact: choosing the smaller template radio applies that template; the document still has no page-level horizontal or vertical scroll (pasteboard and filmstrip stay the only scrollports)

## Risks

- The count is removed placements, not distinct gallery assets, so one photo on two dropped frames counts twice.
- Reapplying a template that drops nothing must not clear a status set by an earlier action.
