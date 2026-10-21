## Proposal

Roadmap: `docs/roadmap/M2.2/folder-skip-non-images.md`. UI: `uikit#/feature/editor-shell-filmstrip`.

### Scope out

- HEIC-specific copy (`heic-unsupported-message`)
- Explicit file-pick per-file errors for non-images
- Filtering inside `collectImageFilesFromDirectory`

### Delta / Risk

- Folder only: non-image-like → skip + one status line; image-like unsupported stay errors.
- Security: post-pick MIME/name skip only; no new FSA/workers/blob/CSP.
- e2e: empty README-only / happy JPEGs+README (skip status, no errors) via `folder-file-input`.
