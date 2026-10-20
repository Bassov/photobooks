## Proposal

Roadmap: [`docs/roadmap/M2.5/editor-chrome-states.md`](../../docs/roadmap/M2.5/editor-chrome-states.md) (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/editor-chrome-states`.

### Scope out

- `import-errors-panel` (dismiss/clear/group/jump store)
- `editor-empty-hints` canvas empty card; `project-screens-adoption`; `dark-theme`
- Growing bang-excluded `HomeScreen.tsx` / `App.tsx` — extract chrome state pieces instead

### Delta / Risk

- E2e: empty filmstrip EmptyState copy; happy import progress (Status + ProgressBar) + Placed Badge; primary interact drag-place/swap + import-error Toast. No page-level H/V scroll; scroll only pasteboard + filmstrip.
- Security: UI/toast wiring only; no change to FSA / import decode / file access.
