## Proposal

Roadmap: [`docs/roadmap/P4/pdf-painter.md`](../../../docs/roadmap/P4/pdf-painter.md) (scope / Done when SoT).

### Scope out

- Cover sheet, endpapers, text frames, captions, folios, frame looks (stroke / mat / radius) and tone adjustments: the painter draws page backgrounds and photos only (captions: `pdf-captions`; cover: `cover-editor`; looks: follow-up `pdf-frame-looks`).
- UI, file writing, progress and streaming (`pdf-export`, `pdf-streaming`).

### Delta / Risk

- New dependencies `@cantoo/pdf-lib` (+ `@pdf-lib/fontkit`, unused until `pdf-captions`); loaded only by a dynamic import inside the PDF worker, never in the editor bundle.
- Security: the worker reads only the photo `Blob`s it is given, no network, no `eval`; the PR body carries the dependency Security Review.
