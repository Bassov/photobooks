## Proposal

Roadmap: `docs/roadmap/P4/pdf-captions.md` (scope / Done when SoT).

### Scope out

- No UI (Print dialog unchanged); no imposition change (it copies the page PDF as is).
- No hinting or OpenType features beyond fontkit's default layout (kerning via `TJ`).

### Delta / Risk

- fontkit 1.x cannot subset WOFF2 or vary WOFF2 composites: `pdfFonts.ts` writes subset glyphs from outlines at the style weight; a fontkit bump must keep `pdfFonts.test.ts` green.
- Security: the PDF worker fetches same-origin `/fonts/*.woff2` (`connect-src 'self'`); no new dependency.
