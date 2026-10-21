## Proposal

Roadmap: `docs/roadmap/M2.2/heic-unsupported-message.md`. UI ref: `uikit#/feature/m0-photo-card`.

### Scope out

- No HEIC decoder / new dependency; DEFERRED.md unchanged
- No import-errors chrome redesign
- Folder skip / failed-import-no-tile already on main

### Delta / Risk

- Empty/happy: HEIC in picker filter; pick → conversion message, no tile, count unchanged. Interact: folder JPEGs+HEIC imports JPEGs, lists only HEIC message.
- Security: accept/FSA widen for visibility only; partition still rejects before enqueue; sniff only unknown-type rejects.
