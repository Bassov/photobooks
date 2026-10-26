## Proposal

Roadmap: `docs/roadmap/M2.6/ui-editor-shell-v93.md`. UI ref: `uikit#/full/editor`, `uikit#/demo`, `uikit#/screen/editor`.

### Scope out

- Kit canvas/inspector features (masters, free frames, text, inspector crop)
- Preview/Print/Publish backends (look-only; in-app Preview deferred)
- Hard-no polish beyond chrome (Package J)

### Delta / Risk

- Empty → open book, empty gallery: kit chrome + pasteboard empty card; happy → kit regions + Pasteboard/Filmstrip; interact → import, place, checking-photos reload, Library back; scroll only pasteboard/filmstrip/spreads-list (no page H/V).
- Security: reuse FSA import + leave-editor; Publish/Preview/Print never hit production.
