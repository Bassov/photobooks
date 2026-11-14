## Proposal

SoT: `docs/roadmap/P4/pdf-export-check.md`; Designer Spec pdf-export PE6, PE7.

### Scope out

- Print dialog, job store, pill, label counts and error note (dialog item); painter marks and progress (`pdf-export-marks`).

### Delta / Risk

- Security: writes stay in the already-granted library folder, fixed `exports/` child, a slug name (FSA rejects separators / `..`).
- Worker request becomes a tagged union (no callers yet).
