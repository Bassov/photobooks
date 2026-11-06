## Proposal

Roadmap: `docs/roadmap/P3/site-preview-mode.md`. UI ref: `uikit#/feature/site-preview-mode`; values: Designer spec `site-preview-mode`.

### Scope out

- `uikit/` and `src/site/**` (embedded book page, CSS split): imported only, except the h1's 4 px gap, which now applies only after "All books" (spec h1 y 128).
- Site settings: "Photobooks", no author.

### Delta / Risk

- Editor key listeners are suspended while the preview is open. There is no page-level H/V scroll; only `site-preview-scroll` scrolls.
- Success: empty (pill disabled at 0 spreads), happy (opens on the cover, → steps), interact (Esc returns the editor unchanged).
