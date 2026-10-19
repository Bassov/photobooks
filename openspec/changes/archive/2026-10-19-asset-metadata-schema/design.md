# Design

## Context

`schemaVersion` 2 asset records hold identity only. Books have no `title`; `BookSummary` is `{ id }`. This prep advances the document shape and records GPS policy before EXIF workers / title UI.

## Goals / Non-Goals

**Goals:** Bump to schemaVersion 3; add book `title` + asset display/capture metadata fields; pure v2→v3 (and chained v1→v3) migration; `BookSummary.title`; GPS opt-in / no site-export rule in `book-core`; tests hit mutation ≥85% (0 NoCoverage) and patch ≥85% on schema+migration.

**Non-Goals:** EXIF/ICC workers, import UI, title rename UX, site-export implementation, filmstrip/ConnectedSpreadView, GATE/CI/stryker edits, new dependencies.

## Decisions

1. **Version** — `CURRENT_SCHEMA_VERSION = 3`. Reject `> 3`; chain `1→2` then `2→3`.

2. **Book `title`** — Optional `z.string()` (may be `""` when present). Migration sets `title: ""` when absent or not a string. **Assumption (apply flip):** planning initially required always-present `title`; apply made it optional so blank-book factories outside the touch-set stay untouched. `BookSummary.title` is always a string (`""` when document title is missing).

3. **Asset metadata fields** (all optional; omit when unknown):
   - `widthPx` / `heightPx` — positive ints; oriented pixel size (after EXIF orientation)
   - `orientation` — int 1..8 (EXIF Orientation)
   - `capturedAt` — non-empty ISO-8601-ish string (`z.string().min(1)`; no full datetime parse in Zod)
   - `colorSpace` — non-empty string (e.g. `sRGB`)
   - `iccProfileName` — non-empty string
   - `mime` — non-empty string (e.g. `image/jpeg`)
   - `meta` — optional object:
     - `title`, `caption`, `camera`, `lens` — non-empty strings when present
     - `keywords` — array of non-empty strings
     - `gps` — `{ lat: number, lon: number }` finite; **present only after user opt-in** (policy; writers land later)

4. **Migration 2→3** — Shallow clone book; `schemaVersion: 3`; if `title` missing or not a string, set `""`; do **not** invent asset metadata/GPS; preserve identity fields and any already-valid metadata keys (pass through; Zod validates after). Invalid leftover keys fail at Zod (same as today for unknown-stripped-by-default? Zod object strips unknown by default — keep default strip).

5. **`BookSummary`** — `{ id: string; title: string }`. Memory `listBooks` reads in-memory `book.title`. FSA `listBooks` lists directory ids, then for each id reads `book.json` text and obtains title **only** via the existing worker-backed `loadBookText` path (same as `loadBook`); main-thread `parseBook`/migrate for listing is forbidden. **Assumption:** every listed id remains in the result; worker/parse failure → `{ id, title: "" }`.

6. **GPS policy (spec only)** — Store `meta.gps` only when the user opts in; site export MUST omit GPS. No export code in this change. `BookSummary.title` ownership lives in `book-core`; `library-storage` gets a one-line MODIFIED scenario that listed summaries include document `title`.

7. **Modules / touch-set** — `src/core/schema.ts`, `migrate.ts`, `migrate.test.ts`, `schema.test.ts`, `parse.test.ts`, `testing/fixtures.ts` (optional `title` override; omit when unset); `src/project/types.ts`, `bookTitle.ts` (+ test), `memory.ts`, `fsa/fsaLibraryStorage.ts` (+ their tests as needed); `.cursor/rules/data-model.mdc`; deltas for `book-core` + `library-storage`; roadmap item ticks. No `package.json`, no GATE/CI, no render/photo UI.

8. **Coverage** — Table-driven schema accept/reject + migration chain tests; kill NoCoverage on new branches. Equivalent mutants listed in tasks.md if any.

## Security

- GPS is PII: absent unless the user opts in; site export MUST omit GPS (policy in `book-core` only; no export implementation here).
- FSA `listBooks` reads only library-owned `book.json` via the existing worker load path; no new handles, blob URLs, or dependencies.

## Risks / Trade-offs

- [GPS PII] → covered in Security; item not security-tagged → no Security Review subagent required for archive.
- [FSA listBooks I/O] → one worker parse per book on list; acceptable for prep; index later if needed.
- [ISO `capturedAt` not calendar-validated] → string min(1) only; tighter validation when EXIF import lands.
- [Zod strips unknown keys] → intentional; migration does not re-encode strip beyond parse.

## Migration Plan

Pure on-load chain. Rollback = revert PR. No production libraries assumed.

## Composition

Pure `src/core` + thin `BookSummary` plumbing in `src/project` (FSA title via existing worker client). No React or new workers.
