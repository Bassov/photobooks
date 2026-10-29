# pdf-captions

Tag: prep
Milestone: P4
Title: text in the PDF

## Scope

- [ ] Captions with the same embedded font files as the DOM painter
- **Browser check:** captions in the PDF match the editor.
- **UI ref:** `kit v0.9.3 #/feature/pdf-captions (removed in kit v0.10.0, no replacement)`
- **UI kit:** none in v0.10.0 (kit v0.9.3 `#/feature/pdf-captions`, removed) — editor vs PDF caption parity
- **Done when:** a PDF with captions renders the same glyph runs as the DOM painter on the caption fixtures (text extracted from the PDF matches)
- **Kit components:** none (PDF output parity, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure text layout; no e2e (no UI)
- **Depends:** pdf-export, text-frame-model (also needs held `text-blocks` re-added first)
