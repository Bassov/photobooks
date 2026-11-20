# site-cover-title-font

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item site-cover-title-font
Status: done

## Scope

Bug B1 of the Designer walkthrough-polish review (Owner Q-21, 2026-11-20): the site / Preview cover title ignores the
book's Title font. `.ss .sd-it` forces the site sans (500, upright) while the book has e.g. `titleFont: serif-italic`.
Designer D38: the front text uses the cover title font.

- [x] Prod: the site cover title (CSS `CoverFace`, CSS `Book3D`, GL `glCover` front panel) takes family / weight /
      style from `cover.style.titleFont` through the one face table CoverView also uses; `sans` keeps the site sans.
- [x] Kit: `#/demo` and personal-site cover titles (CSS `CoverFace`, GL `coverCanvas`) follow the same rule.
- [x] Tests: SiteSlide / SiteHome unit tests pin the title face from the book; one e2e paint check on Preview.
- **Browser check:** Preview of a default (`serif-italic`) book: the cover title reads Lora italic; a `sans` book
  reads as before.

## Done when

- A book with titleFont serif-italic shows the cover title in Lora italic in Preview, the exported site and the kit
  `#/demo` site step (computed style checked in a test); a sans title font still renders as before.
- Ink rule unchanged (D38: luminance < 0.23 → #F5F5F5 else #2E2C2D).
- No other visual change (no type-scale / tracking / radius work: those are later polish items).
