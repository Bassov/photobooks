## Proposal

Prod QA bugfix (no roadmap item): import-error toast description reused the first failed file’s message for every name in the batch.

### Scope out

- Import partition / HEIC sniff / decode pipelines
- Import-errors panel grouping or dismiss UX
- UI kit specimen copy

### Delta / Risk

- Toast description MUST list each failed file with that file’s own message (empty message → name only).
