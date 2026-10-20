## Proposal

Roadmap: [`docs/roadmap/M2.5/ui-primitives-feedback.md`](../../docs/roadmap/M2.5/ui-primitives-feedback.md) (scope SoT). UI ref: `uikit#/components` (`#c-progress`, `#c-toast`, `#c-badge`, `#c-overlays`, `#c-menu`) + EmptyState patterns. `skip_specs: true` (presentational `src/ui`; no domain contract).

### Scope out

- Editor / project adoption (`editor-chrome-states`, `project-screens-adoption`, `import-errors-panel`)
- Forms primitives (`ui-primitives-forms` / M4)
- FeaturedIcon as a separate primitive (inline disc deferred)

### Delta / Risk

- E2e: empty `/`; happy `?fixture=painter`; `?specimen` feedback + overlays (Status, Toast action, Badge, ProgressBar, EmptyState, Dialog Esc, Menu select). No page-level H/V scroll — specimen / filmstrip / pasteboard scrollports only.
