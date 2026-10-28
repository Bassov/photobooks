# frame-geometry-schema

Tag: prep
Milestone: M4
Title: rotation and lock in the document
Status: done

## Scope

- [x] Schema version bump with migration: frame `rotationDeg` and `locked?`; crop quarter-turn rotation and `straightenDeg?`
- [x] Resolver honours frame and photo rotation (`ResolvedItem.rotation`); PBT for rotated geometry
- **Kit components:** N/A (prep; no UI)
- **Demo:** N/A
- **Musts:**
  - Frame gets `rotationDeg?` (degrees; absent → 0) and `locked?` boolean (same convention as `guideSchema.locked`).
  - Crop gains `quarterTurns?` (int 0–3, clockwise) and optional `straightenDeg?` in [-45, 45] in this same bump, so `photo-rotate` needs no further schema prep.
  - `ResolvedItem.rotation: number` comes from frame `rotationDeg`; `photoQuarterTurns` / `straightenDeg` exposed when non-zero; photo/crop rotation honoured in the resolved source crop.
  - `CURRENT_SCHEMA_VERSION` 3 → 4 in this item only: `migrateV3ToV4` sets `rotationDeg: 0` on frames, leaves `locked` unset; reject newer versions.
  - Tests: parse round-trip and rejects, migrate v3→v4 (defaults, odd shapes, v1 chain, newer rejected), resolve rotation, per-turn corner mapping, PBT (crop stays in the unit square for any rotation).
- **Hard nos:** no canvas UI; no selection handles; no move / resize / rotate ops; no GridOverlay / snap; no FrameToolbar; no multi-select; do not fold `frame-transform-ops` or `frame-selection-handles` in.
- **Tokens:** N/A (no UI)
- **Test:** v3 book migrates to v4 with defaults (`rotationDeg` 0 / unlocked); parse accepts `rotationDeg` + `locked`; resolve exposes `ResolvedItem.rotation` from the schema; migrate rejects `schemaVersion` > current.
- **Depends:** none (soft: `frame-transform-ops`, `frame-selection-handles`).
