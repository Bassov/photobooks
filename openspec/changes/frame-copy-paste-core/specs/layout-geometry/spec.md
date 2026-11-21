## ADDED Requirements

### Requirement: Frame copy, paste and duplicate ops

The core SHALL paste a version 1 frames payload with `pasteFrames` / `duplicateFrames`: copies go on top with new ids, unlocked, as own frames, the spread leaves its template, and the group keeps its relative layout, stepping +5/+5 mm (≤ 20, never in place) while taken and clamped into the target pages + bleed.

#### Scenario: Duplicate steps off its source

- **WHEN** a frame at (10, 10) is duplicated with offset (0, 0)
- **THEN** the copy lands at (15, 15) on top with a new id, and the source is unchanged

#### Scenario: Paste into another book

- **WHEN** a caption's anchor is not pasted and a photo's asset is not in the target book (by `contentHash`, else `sourceRootId` + `relativePath`)
- **THEN** the caption is static with its copied text and the photo frame pastes empty
