## Proposal

Roadmap: [`docs/roadmap/M2.5/editor-empty-hints.md`](../../docs/roadmap/M2.5/editor-empty-hints.md) (SoT). UI: `uikit#/feature/editor-chrome-states`, `editor-shell-filmstrip`.

### Scope out

- M8 onboarding (start screen, sample book, tour)
- `folder-skip-non-images` pipeline (only card + “No photos found…” on zero-import)
- Home EmptyState / project-screens-adoption

### Delta / Risk

- E2E empty/happy/interact: fresh card → Add photos opens `photo-file-input`; import → hint; drag-place → hint gone. No page H/V scroll. Spec delta `editor-shell`. Security: reuse FSA pickers/inputs; no new handles.
