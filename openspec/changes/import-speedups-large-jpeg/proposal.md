## Proposal

Owner-approved off-roadmap prep. SoT: owner ask 2026-10-25 + IMPORT-PERF-1200.md (lazy JPEG, defer 1280, single body-read, import decode 6–8).

### Scope out

- Missing mid-import (PR #201); content-hash / skip cheap scan; tier edges ≠ 320+1280.

### Delta / Risk

- Import “done” ≠ all decoded — keep progress UX honest.
- Security: transfer/reuse worker body once; FSA reads capped; no second full-body read.
- Filmstrip: empty → EXIF/placeholder → scroll mid/tail; no page-level H/V scroll — only filmstrip scrollport.
