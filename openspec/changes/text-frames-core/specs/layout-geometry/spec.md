## ADDED Requirements

### Requirement: Text frame resolve and ops

A resolved text frame SHALL carry `text { text, styleId, align }` (defaults `caption` / `left`). Ops: `addTextFrame` (rejected under 10 × 4.5 mm; top `z`, empty static text; keeps `templateId`), `editText` (optional `fitHeightMm` grows `rect.height` only, capped at the paper bottom), `setTextStyle`, `setTextAlign` (never change `rect`); image frames and unchanged values are no-ops. Photo ops SHALL leave text frames unchanged.

#### Scenario: Grow on edit stops at the paper bottom

- **WHEN** `editText` on a text frame at y 280 mm, height 14 mm on a 300 mm-high spread passes `fitHeightMm` 40
- **THEN** the frame height becomes 20 mm, and `setTextStyle` afterwards leaves the rect unchanged

### Requirement: Layouts keep text frames

Applying a built-in or saved layout SHALL lay out image frames only (photos by index among them); text frames SHALL keep rect, content and style, stay above every image frame and keep their relative order.

#### Scenario: Layout keeps the text frame

- **WHEN** a built-in or saved layout is applied to a spread holding a photo frame and a text frame
- **THEN** the text frame keeps its id, rect and content, and its `z` is above every image frame
