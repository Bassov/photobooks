## Proposal

Roadmap: `docs/roadmap/P1/decode-slot-busy-until-reply.md` (scope / Done when SoT).

### Scope out

- Pool size, lane order and backoff stay as they are.
- In-flight 1280 working-preview jobs and caller-signal aborts keep today's abort (the caller still gets AbortError at once). Exception: a thumb320 already kept through leave-now runs to completion even if its caller aborts later.

### Delta / Risk

- A slot that was aborted stays busy until its worker replies, so for one decode the pool has one fewer slot. Today the same worker would decode two files at once.
