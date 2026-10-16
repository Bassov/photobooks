# Design

## Context

See proposal.md. `src/core` is at `schemaVersion` 1 with `assetSchema = z.object({})`. Migration is identity. Architecture: asset identity = source-root id, relative path, size, mtime, SHA-256 hash. This change is the schema bump only.

## Goals / Non-Goals

**Goals:** Advance to schemaVersion 2; define optional asset-record fields; pure v1→v2 migration; keep parse/serialize/invariants/ops green via shared fixtures.

**Non-Goals:** Hashing workers, `AssetSource`, OPFS cache, open/save UI, inventing identity metadata on migrate or `addToGallery`.

## Decisions

1. **Field names** — On each asset value: optional `sourceRootId` / `relativePath` / `contentHash` (`z.string().min(1)` when present), `byteSize` (`z.number().int().nonnegative()`), `mtimeMs` (`z.number()`; Zod rejects non-finite by default). No id on the value (key remains identity). **Assumption:** `byteSize` / `mtimeMs` / `contentHash` names beat ambiguous `size` / `mtime` / `hash` for JSON clarity.

2. **All fields optional** — v1 `{}` and new gallery adds stay `{}`. Populating fields is `asset-identity` / open-save. Zod: `.optional()`; omit over `undefined` (`exactOptionalPropertyTypes`).

3. **Migration** — In `migrate.ts`, step 1→2: clone shallow book, set `schemaVersion: 2`, map each asset entry to `{}` (drop unknown keys if any). Current-version input passes through unchanged. Reject `< 1` and `> CURRENT` as today.

4. **Modules** — Touch existing: `schema.ts` (`CURRENT_SCHEMA_VERSION = 2`, `assetSchema`), `migrate.ts` (step), `testing/fixtures.ts` (defaults still `{}`), `parse.ts`, `parse.test.ts`, `migrate.test.ts` (add if missing). Export `Asset` type from schema/index if useful. No new subsystem folder.

5. **Ops** — `addToGallery` keeps `{ [id]: {} }`. No op API change.

6. **Docs** — `.cursor/rules/data-model.mdc`: note asset-record fields + v2. Nested roadmap tick on archive.

## Touch-set

`src/core/schema.ts`, `src/core/migrate.ts`, `src/core/parse.ts`, `src/core/parse.test.ts`, `src/core/migrate.test.ts` (create if absent), `src/core/testing/fixtures.ts` (+ any fixture churn that hardcodes `schemaVersion: 1`), `.cursor/rules/data-model.mdc`, archive sync `openspec/specs/book-core/`, nested roadmap tick.

## Composition

Pure `src/core` only — no React, workers, or FSA. Later `asset-identity` writes these fields; library load already runs `parseBook` in a worker.

## Tests

Public API: `parseBook`, `serializeBook`, `migrateToCurrent`, `CURRENT_SCHEMA_VERSION`, `addToGallery`. Shared `makeBook` / `makeBookWithAsset`. Cases: v1→v2 empty assets; full record accept; negative `byteSize` reject; empty-string `sourceRootId` / `relativePath` / `contentHash` reject; round-trip PBT still valid. No e2e / UI / LHCI.

## Risks / Trade-offs

- [Fixture churn on schemaVersion] → centralize in `makeBook` defaulting to `CURRENT_SCHEMA_VERSION`.
- [Empty migrated assets] → intentional until hashing lands.
- [Hash format not validated as 64-hex yet] → accept non-empty string; tighten in `asset-identity` if needed.

## Migration Plan

Pure document migration on load. Rollback = revert PR. No production libraries assumed.
