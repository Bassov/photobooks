# Design

## Context

See proposal.md. No `src/core` yet. Zod is already a dependency (`src/photo/exifSchema.ts`). Layer rules live in `.dependency-cruiser.cjs` (`lib-is-pure` pattern). Document model: `docs/future-architecture.md`.

## Goals / Non-Goals

**Goals:** Ship a pure, testable book document API (schema, parse/serialize, migrate, invariants, structural-sharing updates) and wire docs + `core-is-pure`.

**Non-Goals:** Layout ops/templates/resolve, UI wiring, persistence, new npm deps (no Immer).

## Decisions

1. **Modules** — Small files under `src/core/`:
   - `schema.ts` — Zod schemas + inferred types + `CURRENT_SCHEMA_VERSION`
   - `migrate.ts` — version gate + chain scaffold (`migrateToCurrent`)
   - `invariants.ts` — referential checks returning typed errors
   - `parse.ts` — `parseBook` / `serializeBook` (migrate → Zod → invariants)
   - `update.ts` — `updateSpread` / `updateFrame` with reference equality
   - `index.ts` — public exports
   - `testing/fixtures.ts` — shared valid books for unit/PBT

2. **Schema shape (v1)** — Book: `{ schemaVersion, id, settings, layoutGrid, guides, assets, gallery, spreads }`. Settings: trim `{ widthMm, heightMm }`, `bleedMm`, `safeMarginMm`. Layout grid: margins `{ top, right, bottom, left }`, `columns`, `rows`, `columnGutterMm`, `rowGutterMm`. Guide: `{ id, orientation, offsetMm, locked? }`. Spread: `{ id, templateId?, layoutGrid?, guides?, frames }`. Frame: `{ id, rect: { x, y, width, height }, z, assetId?, crop? }` with crop `{ zoom ≥ 1, center: { x, y } }`. **Units:** every geometric length without a unit suffix (`margins`, `rect`, crop center is unitless 0–1) is millimeters. **Assets:** `assets` is `Record<AssetId, Asset>`; canon identity is the Record key. `Asset` is `{}` (placeholder for later metadata) — do not duplicate id on the value. **Gallery:** ordered unique asset ids (Zod + invariants reject duplicates).

3. **Invariants (parse boundary)** — After Zod: (1) every frame `assetId` ∈ `assets` keys; (2) every placed `assetId` ∈ `gallery`; (3) every gallery id ∈ `assets` keys; (4) gallery ids are unique. See delta spec Requirement: Referential invariants.

4. **Errors** — Discriminated results (`ok` | `newer-schema` | `invalid-shape` | `invariant`), not thrown Zod errors across the public boundary.

5. **Updates** — Hand-rolled: map spreads; if `fn(spread) === spread`, reuse book/spreads array references. Same for frames inside a spread.

6. **Purity gate** — Add `core-is-pure` mirroring `lib-is-pure` (forbid React and `src/(photo|perf|App)`).

7. **Docs** — Rewrite `.cursor/rules/data-model.mdc` to spreads/frames/gallery; add `src/core` + `book-core` to `AGENTS.md`; tick nested roadmap checkboxes during apply.

## Touch-set

- `src/core/*` (+ `*.test.ts`, fixtures)
- `.dependency-cruiser.cjs`
- `AGENTS.md`, `.cursor/rules/data-model.mdc`, `docs/roadmap.md` (nested ticks)
- `openspec/specs/book-core/` (via archive sync)

## Composition

Pure domain only — no React entrypoint import in this change (knip: export from `index.ts`; tests import public API). Later `layout-geometry` adds ops beside these modules.

## Tests

Public API: `parseBook`, `serializeBook`, `migrateToCurrent`/`CURRENT_SCHEMA_VERSION`, `updateSpread`/`updateFrame`. Shared fixture builders in `src/core/testing/fixtures.ts`. Unit cases for reject paths; `@fast-check/vitest` PBT for round-trip and structural sharing. No e2e (no UI).

## Risks / Trade-offs

- [Asset too thin] → Accept; hash/path land with `LibraryStorage`, not this schema.
- [Knip unused exports] → Keep surface minimal; tests + index exports count as use.
- [exactOptionalPropertyTypes] → Prefer omit over `?: undefined` for optional frame/crop fields.

## Migration Plan

Greenfield module. Rollback = revert PR. No persisted books in production yet.
