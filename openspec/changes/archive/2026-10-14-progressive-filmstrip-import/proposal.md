# Proposal

## Problem

During multi-file import the header shows progress (`Importing N / M…`) while the filmstrip keeps a frozen pre-import gallery id list until the batch finishes. Users wait for the whole import before any new placeholders appear, which feels broken relative to “placeholders first, thumbnails stream in.”

## Why now

Editor shell + filmstrip are on the feature branch; progressive mid-import visibility is the intended UX from the roadmap, and the freeze was only a LoAF trade-off that we can reverse while re-checking the existing bulk-import scroll gate.

## Scope in

- Stop freezing the filmstrip’s visible gallery id list for the duration of a bulk import
- Let placeholders enter the strip as gallery ids flush (rAF-paced); thumbs still stream per asset as workers finish
- Keep import progress UI, spacer reservation via expected count, and scroll during import
- Update `editor-shell` requirements; unit + e2e coverage that gallery count grows mid-import; retain zero-LoAF bulk scroll gate and page-fit asserts

## Scope out

- Changing picker / MIME / worker decode pipeline
- Enqueue-on-result only (no early placeholders)
- Pasteboard / place-on-spread / filmstrip management features
- New scrollports or Virtualizer redesign

## Capabilities

### Modified Capabilities

- `editor-shell`: filmstrip MUST show new gallery ids progressively during an active multi-file import (no batch freeze); placeholder → thumb still applies per asset

## Success criteria

- After starting a multi-file import, filmstrip `data-gallery-count` (and visible placeholders) increase before the batch completes — not only when progress finishes
- Progress text remains visible; filmstrip stays scrollable during import
- Bulk import + scroll scenario still meets zero-LoAF / frame-budget gates
- No page-level H/V scroll; scrolling only inside the filmstrip scrollport (`filmstrip-scroll`)

## Risks

- Unfreezing ids may remount GridList chunks under CPU throttle and regress LoAF — mitigate with existing rAF flush / reveal / thumb pacing; tune constants before restoring freeze
- Security surface: blob/object URL thumbs unchanged; no new File System Access or worker protocol
