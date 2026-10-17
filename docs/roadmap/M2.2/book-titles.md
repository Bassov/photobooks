# book-titles

Tag: feature
Milestone: M2.2
Title: create-with-title and rename

## Scope

- [ ] Books show by title instead of the raw id: create book asks for a title; rename from home and from the editor; home list and editor chrome show the title (the `title` field from `asset-metadata-schema`; books without one fall back to "Untitled book")
- **Perf:** title edits are local string updates; no layout thrash. Gate: rename while the filmstrip scrolls — zero LoAF.
- **Browser check:** create a book with a title, rename it, reload and reopen — the title persists; the home list shows titles, not ids.
