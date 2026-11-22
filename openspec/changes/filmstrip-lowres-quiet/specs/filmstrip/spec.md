## MODIFIED Requirements

### Requirement: Low-res chip on filmstrip thumbnails

A filmstrip thumb SHALL show the kit "Low-res" chip (top-left, warning icon) when the photo, filling one page of the current book, falls below the canvas low-res badge threshold (`lowDpi(frameDpi(…))`). The check SHALL use stored pixel dimensions only (no decode) and SHALL follow book size changes. The chip SHALL be icon-only at every thumb width (18 × 16.84, no visible text), named "Low-res" by `title` and `aria-label`. The Photos dock head SHALL append " · N low-res" in the warning ink after "· M used" when N > 0 photos of the shown strip carry the chip (the same predicate), and nothing about low-res when N = 0.

#### Scenario: Small photo is flagged

- **WHEN** a photo whose page-fill resolution is below 200 dpi is in the gallery
- **THEN** its thumb shows the icon-only "Low-res" chip, a photo at or above 200 dpi shows none, and the dock head ends "· 1 low-res"
