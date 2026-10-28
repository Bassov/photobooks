# fix-place-fit-aspect

Tag: prep
Milestone: M3
Title: Fix placed photo aspect: no stretched portraits, cover crop in thumbs and canvas
Status: done

## Scope

- [x] Drop unrotated embedded EXIF thumbs whose orientation disagrees with the corrected photo (stretched portraits in canvas and Pages thumbs)
- [x] Geometry unit test: default fill covers portrait/landscape/panorama in a 14.8x21 page without stretch
- [x] e2e: canvas and Pages thumb image boxes keep the bitmap aspect
- **Done when:** portraits are never stretched; landscapes in portrait frames fill via center crop; Pages thumbs match the canvas

## Done note

shipped in fix-place-fit-aspect
