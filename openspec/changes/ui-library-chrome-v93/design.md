## Decisions

1. Port kit look in-place on existing `LibraryScreen` / `LibraryBar` / `BookTile` / `BookObject` / `LibSearch` / `LibSort` — never import `uikit/src/**`. Tokens: `--primary` (ink Create), `--chrome`, `#D7D7D7` quiet fields, `--font-heading` / `--heading-weight` (`docs/design.md`).
2. Visibility: bar tools `shrink-0`; path truncates; Create stays black primary + `shadow-ink-sm` in the “Your books” row so ≥1280×800 shows Create + Search + Sort + gear.
3. Type parity: body `font-synthesis-weight: none` (kit) so Lora `<em>` italicizes; headings use `--heading-weight` (500). No family swap.
4. Optional `BookSummary.editedAtMs` from FSA `book.json` lastModified / memory save clock; UI formats relative “edited …” and sorts Last edited by that when present. Omit meta suffix when unknown.
5. Covers stay title-only BookObject (spine + page edge + italic) — no cover decode this package.

## Touch-set & Test Plan

- Files: `styles/app.css`; `LibraryBar` / `LibraryScreen` / styles; `BookTile` / filter / edited formatter; `BookSummary` + FSA/memory list + file handle mtime; `docs/design.md` if needed; e2e library chrome; OpenSpec `editor-shell` + `library-storage`.
- Reuse: existing session create/rename/open/list; kit geometry in `bookObjectLayout`.
- Tests: unit meta/edited/sort/synthesis-facing styles; contract `editedAtMs`; e2e empty lock-in + happy 1280×800 Create/Search/Sort/gear + book-object spine + meta; scrollport `library`; skill `ui-review` before push.
