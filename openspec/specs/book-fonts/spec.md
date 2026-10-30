# book-fonts Specification

## Purpose

Curated book font files (woff2, Latin + Cyrillic) shared by the DOM and the later PDF painter, with a registry and a `document.fonts` loader.

## Requirements

### Requirement: Curated book font registry

The system SHALL expose a curated set of woff2 faces (Inter Variable upright; Lora Variable upright and italic; each in latin, latin-ext and cyrillic) with file name, style, weight range and codepoint ranges. Every registered file MUST exist under `public/fonts/` as valid woff2, and the registry MUST match `public/fonts/fonts.css` face for face.

#### Scenario: Latin and Cyrillic coverage

- **WHEN** a Latin or basic Cyrillic codepoint is looked up for a family and style in the set
- **THEN** at least one registered face covers it

#### Scenario: Registry matches shipped CSS

- **WHEN** the registry is compared with `fonts.css`
- **THEN** files, families, styles, weight ranges and unicode ranges are identical

### Requirement: Book font loading

The system SHALL load every registered face from an injected file reader into `document.fonts`, resolve only after each face loaded and `document.fonts.ready` settled, reject if any file fails to read, and return the raw bytes per file so the PDF painter embeds the same files.

#### Scenario: Ready before resolve

- **WHEN** `fonts.ready` is pending
- **THEN** loading does not resolve until it settles
