# Proposal

## Problem

Filmstrip items use a fixed landscape box with cover crop, so portrait, square, and non-standard photos look identical and are cropped. Session aspect metadata already exists after import but the UI ignores it. Import progress lives only in the header, not next to the strip where users watch placeholders stream in.

## Why now

Editor shell + progressive filmstrip are on the feature branch; the roadmap already requires aspect-ratio placeholders. Closing the gap before pasteboard/DnD avoids baking fixed-size thumbs into later drag affordances.

## Scope in

- Aspect-driven filmstrip card silhouettes (fixed height, width from clamped aspect) so landscape / portrait / square / unusual ratios are visually distinct
- Full-photo thumbnails inside those slots (no default cover crop); placeholders use the same sizing once aspect is known
- Compact status strip above the filmstrip scrollport: gallery count always; completed/total while import runs (relocate progress from header)
- Update `editor-shell` and `photo-card` requirements for aspect-visible cards and filmstrip status

## Scope out

- Worker decode / thumb max-edge changes
- Pasteboard, DnD, placed badges, adjustable filmstrip height
- Merging the filmstrip stack to `main`

## Capabilities

### Modified Capabilities

- `editor-shell`: aspect-aware filmstrip item sizing and full-photo previews; gallery/import status strip on the filmstrip
- `photo-card`: filmstrip representation MUST reflect asset aspect in the visible card silhouette (not only store metadata)

## Success criteria

- Portrait vs landscape vs square items have observably different card widths at the same thumb height; preview shows the whole photo (no default cover crop)
- Placeholders resize with known aspect; unknown aspect uses a safe default until meta arrives
- Filmstrip status shows total photo count and live import progress during multi-file import
- No page-level H/V scroll; scrolling only inside the filmstrip scrollport (`filmstrip-scroll`)
- Existing progressive-import and bulk-import LoAF e2e still pass

## Risks

- Variable-width filmstrip layout may break scroll extent / windowing math or regress LoAF under bulk import + scroll
- Aspect updates after decode may cause visible slot jumps or excessive re-renders if poorly paced
- Security surface: blob/object URL thumbs unchanged; no new File System Access or worker protocol
