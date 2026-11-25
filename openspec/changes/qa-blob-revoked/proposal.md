## Proposal

Roadmap SoT: `docs/roadmap/P5/qa-blob-revoked.md` (QA-5).

### Scope out

- Open-PDF blob URL (`startPrint.ts`, read by another tab) and React-side refcounting; cache caps unchanged.

### Delta / Risk

- Security (blob URLs): a held URL stays same-origin, readable only while an element of this document points at it.
- Perf: one batched DOM check per task with revokes; no work on hot handlers.
