## Proposal

Roadmap: `docs/roadmap/P2/filmstrip-appledouble-skip.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- Tooltip asset-id fallback after reload; thumb warm-lane decode failures; migrating old books (filter only).

### Delta / Risk

- e2e observables: 0 undecoded tiles after reload ×2, empty Import errors for metadata files, corrupt JPG listed with no tile.
- Security: no new FS permissions or handles; the path check is a string filter; `decodeFailed` is IDB metadata, never exported.
