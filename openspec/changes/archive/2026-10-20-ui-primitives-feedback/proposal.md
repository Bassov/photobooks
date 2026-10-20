## Proposal

Roadmap: [`docs/roadmap/M2.5/ui-primitives-feedback.md`](../../docs/roadmap/M2.5/ui-primitives-feedback.md) (scope SoT). UI ref: `uikit#/components` (`#c-progress`, `#c-toast`, `#c-badge`) + EmptyState patterns. `skip_specs: true` (presentational `src/ui`; no domain contract).

### Scope out

- Overlays Dialog / AlertDialog / Popover / Menu → `ui-primitives-overlays`
- Editor / project adoption (`editor-chrome-states`, `project-screens-adoption`)
- Forms primitives (`ui-primitives-forms` / M4)

### Delta / Risk

- E2e: empty `/`; happy `?fixture=painter`; `?specimen` feedback section (Status polite/assertive, Toast error+action, Badge tones, ProgressBar determinate/indeterminate, EmptyState CTA). No page-level H/V scroll — specimen / filmstrip / pasteboard scrollports only.
