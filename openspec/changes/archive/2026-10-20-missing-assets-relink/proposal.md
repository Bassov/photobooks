## Proposal

Roadmap: `docs/roadmap/M2.5/missing-assets-relink.md` (scope / Browser / Perf SoT). UI ref: `uikit#/feature/missing-assets-relink`.

### Scope out

- Full `src/ui` token migration (`project-screens-adoption`)
- Export pause beyond UI copy; Locate… / tabs (`missing-assets-relink-actions`)
- Silent auto-relink without Resolve

### Delta / Risk

- E2E: empty (no problems), happy (hash rescan → Resolve), interact (relink list + filmstrip scroll during rescan). No page H/V scroll; only named scrollports.
- Security: read-only FSA picks; handles off domain matcher; scan/hash in workers.
