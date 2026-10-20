## Proposal

Roadmap: [`docs/roadmap/M2.5/ui-primitives-actions.md`](../../docs/roadmap/M2.5/ui-primitives-actions.md) (scope SoT). UI ref: `uikit#/components` (`#c-button`, `#c-icon-button`, `#c-toggle`, `#c-toolbar`). `skip_specs: true` (presentational `src/ui` chrome; no domain contract).

### Scope out

- Editor chrome adoption (`editor-chrome-toolbar` later)
- Full kit Button variant matrix beyond `default` / `secondary` / `ghost` (roadmap primary/quiet aliases)
- Feedback overlays (Popover / Dialog / Toast)

### Delta / Risk

- E2e: empty `/`; happy `?fixture=painter`; `?specimen` actions section (click primary, tooltip on IconButton, segmented select, toolbar role). No page-level H/V scroll — specimen / filmstrip / pasteboard scrollports only.
