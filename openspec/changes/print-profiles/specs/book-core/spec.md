## ADDED Requirements

### Requirement: Printer profile data

A printer profile SHALL parse with Zod and carry trim and page-bleed ranges, cover bleed, safe margin, page count `{min, step, max}` (`max - min` a multiple of `step`), single first page, printed endpapers, spine (`formula` base + per page, or a `table` ascending by page count; manual override allowed or not), `output` `pages` | `spreads`, crop marks (default off), color space `srgb`, file limits, DPI `warn` ≥ `min`, and minimum font size. Low-DPI checks SHALL use the book's effective profile thresholds; the built-in `generic` profile and an unknown profile id use 200 / 150.

#### Scenario: Profile thresholds drive the low-DPI level

- **WHEN** a frame's effective DPI is 180 and the profile's DPI is `{ warn: 200, min: 150 }`
- **THEN** the frame reports `warn`, and with `{ warn: 300, min: 200 }` it reports `min`
