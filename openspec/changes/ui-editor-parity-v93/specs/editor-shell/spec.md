## ADDED Requirements

### Requirement: Kit v0.9 hard-no chrome parity

Editor chrome SHALL enforce kit v0.9.x hard-nos: grayscale chrome; filmstrip / template / spreads-list selection tone `#CACACA` only; black outline reserved for canvas frame selection + handles (and primary Create); Space = pan only while held (panel hotkeys ignored; `data-panning` suppresses canvas focus ring); no Replace button or photo-picker modal; folder/filmstrip progress messages on the quiet status line (import-error Show-files toast MAY remain for failure panel entry); wheel zooms the pasteboard; quiet Preview/Print/Publish unchanged. No page-level H/V scroll.

#### Scenario: Hard-nos hold on live editor

- **WHEN** the editor surface is active with a library-backed book
- **THEN** chrome selection is tone-only, Space pans without toggling panels, no Replace control is offered, and folder messages appear on the status line
