Roadmap: `docs/roadmap/P4/pdf-export-kit.md` (scope / Done when / Browser SoT; UI ref: uikit#/demo → Print).

### Scope out

- Print pill, `usePrintRun`, feature-page states, demo steps 27–31 + baseline (next item `pdf-export-kit-pill`).
- Prod dialog, worker check, painter, exports write; `qa.mjs` stays frozen.

### Delta / Risk

- Kit only, no spec delta. e2e locks clean, issues, run (Esc hides), done (Open PDF), failed (Try again); the check list scrolls in its own box, no page-level scroll.
- Security: Open PDF opens a static sample-PDF blob URL (no user data) in a tab with `opener` cut, revoked after 60 s.
