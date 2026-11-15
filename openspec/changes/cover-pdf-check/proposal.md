## Proposal

Roadmap: `docs/roadmap/P4/cover-pdf-check.md` (scope / Done when). Designer: cover-pdf Must CP3, decision C9.

### Scope out

- Print dialog UI, worker `check` wiring and the cover painter (items cover-pdf, cover-pdf-paint).
- Real text measuring: the caller injects the spine text advance.

### Delta / Risk

- Cover rules run only when `preflight` gets a `cover` option; the worker passes none yet, so the dialog's rows stay as today.
