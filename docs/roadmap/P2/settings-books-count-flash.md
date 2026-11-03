# settings-books-count-flash

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item settings-books-count-flash

## Scope

- [ ] Settings opened from the editor shows a muted "—" in the Books row while `listLibraryBooks` is pending or failed, never a number it has not listed (was "0" for ~250 ms before "1")
- [ ] Library Settings uses the same rule: "—" until the first listing for the current library lands, and while a changed library folder is being listed (was "0" / the previous library's count)
- [ ] A real empty library still shows "0"
- **Bug rule:** every caller of `listLibraryBooks` that renders a count is listed in the PR body as fixed or left out with a reason
- **Done when:** unit tests for pending → "—", resolve → count, real 0 books → "0", failure → "—" (editor and library Settings); an e2e DOM probe of editor → Settings (MutationObserver + 16 ms samples for 500 ms) never sees "0" and ends at the listed count; unit + typecheck green, full e2e at the end
- **Perf:** N/A — one nullable state per screen, no extra listing
- **Browser check:** open a library with one book, open the book, press the gear: the Books row reads "—" or "1", never "0"
- **Hard nos:** no `uikit/` edits; no edits in `UnsupportedBrowserScreen.*` (other lanes)
- **Source:** Designer parity r17 2026-11-03 (`r17-parity.md`, Notes)
