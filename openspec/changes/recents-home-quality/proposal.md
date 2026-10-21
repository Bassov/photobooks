## Proposal

Roadmap: `docs/roadmap/M2.2/recents-home-quality.md` (`UI ref: uikit#/feature/recents-home`, `uikit#/feature/project-screens-adoption`).

### Scope out

- IDB faults / blocked e2e / recents dedup + eviction → `recents-idb-dedup`
- LHCI, IDB v1→v2, FSA permission e2e (backlog); import / `filmstrip.spec.ts`

### Delta / Risk

- Home a11y + readable status (deny≠cancel; no raw codes); drop `__photobooksE2e`; peek-failed re-grant refuses arbitrary folder bind (FSA). Empty + Start editing → empty-editor card; list/permission/busy via RTL. No page-level H/V scroll — only named `home` and `pasteboard-scroll` scrollports.
