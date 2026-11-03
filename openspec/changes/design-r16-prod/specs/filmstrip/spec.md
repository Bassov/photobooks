## ADDED Requirements

### Requirement: Low-res chip on filmstrip thumbnails

A filmstrip thumb SHALL show the kit "Low-res" chip (top-left, warning icon) when the photo, filling one page of the current book, falls below the canvas low-res badge threshold (`lowDpi(frameDpi(…))`). The check SHALL use stored pixel dimensions only (no decode) and SHALL follow book size changes.

#### Scenario: Small photo is flagged

- **WHEN** a photo whose page-fill resolution is below 200 dpi is in the gallery
- **THEN** its thumb shows the "Low-res" chip, and a photo at or above 200 dpi shows none
