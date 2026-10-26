## Proposal

Roadmap: `docs/roadmap/M2.6/ui-library-chrome-v93.md`.

### Scope out

- Settings (L), Create dialog (M), editor look (N)
- Cover decode; new editor capabilities; site/print

### Delta / Risk

- Empty → example cover + Create + no “0 books”; happy → ≥1280×800 Create (black) + Search + Sort + gear + book-shaped covers + `N pages · edited …` when mtime known; interact/scroll → search/sort + `library-scroll` only (no page H/V).
- Security: FSA Change/list unchanged; `editedAtMs` from `book.json` mtime only (no paths in summaries).
