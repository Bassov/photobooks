## Proposal

Roadmap: `docs/roadmap/M2.6/ui-library-empty-v93.md`. UI: `uikit#/screen/home` (empty), `uikit#/demo` create-book.

### Scope out

- Library grid polish / search/sort (`ui-library-grid-v93`)
- Editor, Settings redesign, Welcome / UnsupportedBrowserScreen
- Fake FolderPicker — real FSA only

### Delta / Risk

- E2e: empty → example + plain `screen-credit` + Create dialog; cancel stays; create→editor. No page H/V scroll — overflow only in `library` (`library-scroll`).
- Kit cm→`settings.trim` mm via `createBookInLibrary` (no schema bump). Security: existing FSA Change library only — no new FSA/blob/worker/fake picker.
