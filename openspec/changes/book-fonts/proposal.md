## Why

Scope and acceptance: `docs/roadmap/P2/book-fonts.md`.

## Scope out

- No UI, no font picker, no PDF painter (it will reuse the same files).
- No new font files: the curated set is the shipped Inter + Lora woff2.

## Delta / Risk

- New `src/fonts/`: pure registry plus `loadBookFonts` over `FontFace` and `document.fonts`.
- Security: font bytes come from the book folder via an injected reader; no new URLs or workers.
