## Proposal

Roadmap: [`docs/roadmap/P2/parent-overrides-kit.md`](../../../docs/roadmap/P2/parent-overrides-kit.md). UI ref: `uikit#/demo`.

### Scope out

- Prod `src/`; kit canvas context menus; folio overrides; keep-copies master switch (prod core only).

### Delta / Risk

- skip_specs: true (kit only). Observables: empty (no `parent-changes` block), happy (Ctrl+Shift → copy + badge + rows → Reset all), interact (copy reselect, drag, Del, guide to ruler). No scrolling change: no page scroll on `#/demo`.
- Risk: the Ctrl+Shift capture must leave plain Shift-toggle selection untouched.
