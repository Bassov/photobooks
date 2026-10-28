# frame-geometry-schema

Tag: prep
Milestone: M4
Title: rotation and lock in the document
Status: done

## Scope

- [ ] Schema version bump with migration: frame `rotationDeg` and `locked?`; crop quarter-turn rotation and `straightenDeg?`
- [ ] Resolver honours frame and photo rotation (`ResolvedItem.rotation`); PBT for rotated geometry
- **Kit components:** N/A (prep; no UI)
- **Demo:** N/A
- **Musts:**
  - Frame gets `rotationDeg` (degrees; absent → 0); frame-level `locked?` boolean (same convention as `guideSchema.locked`).
  - Crop gains quarter-turn rotation and optional `straightenDeg?` in this same bump, so `photo-rotate` needs no further schema prep.
  - `ResolvedItem.rotation` comes from frame `rotationDeg`; photo/crop rotation is honoured in the resolved source crop.
  - `CURRENT_SCHEMA_VERSION` 3 → 4 in this item only: migrate (v3 frames get `rotationDeg: 0`, unlocked) and reject newer versions.
  - Tests: parse / resolve / migrate cover defaults, round-trip, and old books migrating cleanly.
- **Hard nos:** no canvas UI; no selection handles; no move / resize / rotate ops; no GridOverlay / snap; no FrameToolbar; no multi-select; do not fold `frame-transform-ops` or `frame-selection-handles` in.
- **Tokens:** N/A (no UI)
- **Test:** v3 book migrates to v4 with defaults (`rotationDeg` 0 / unlocked); parse accepts `rotationDeg` + `locked`; resolve exposes `ResolvedItem.rotation` from the schema; migrate rejects `schemaVersion` > current.
- **Depends:** none (free-frames is on main). Soft: `frame-transform-ops` and `frame-selection-handles` consume these fields after this merges.
