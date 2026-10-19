# Proposal

## Problem

Asset records hold identity only (path, size, hash). Capture time, oriented pixel size, EXIF orientation, color space, mime, and optional descriptive/camera/GPS meta are not in the document, so later import and library UX cannot persist or display them. Books also lack a `title` on the document and on `BookSummary`.

## Why now

M2.2 review cut requires photo metadata in the document. This `[prep]` locks the schema + migration + GPS policy before off-main-thread EXIF read and title UI land.

## Scope in

- Schema version bump (2 → 3) with pure migration
- Asset fields: oriented pixel size, EXIF orientation, optional `capturedAt`, color space + ICC name, mime, optional `meta` (title, caption, keywords, camera, lens, GPS)
- Book `title`; `BookSummary.title`
- `book-core` spec decision: GPS stored only on user opt-in; never leaves the library in site export
- Parse/serialize, fixtures, tests; mutation ≥85% / patch ≥85% on schema+migration; no new deps

## Scope out

- EXIF/ICC extraction workers, import UI, title rename UX, HomeScreen polish
- ConnectedSpreadView / filmstrip thumbnails, GATE/CI/stryker config, package.json deps
- Site-export pipeline implementation (policy only in spec)

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `book-core`: metadata + book title fields; schemaVersion 3; v2→v3 migration; GPS opt-in / no-export rule
- `library-storage`: book summaries include document `title`

## Success criteria

- `CURRENT_SCHEMA_VERSION` is 3; v1→v2→v3 and v2→v3 migrations preserve prior fields and do not invent metadata
- Parse accepts full optional metadata / rejects malformed values; empty assets and title-less books still parse (title default policy in design)
- `BookSummary` includes `title`; storage list surfaces it from the book document
- Spec records GPS opt-in + never in site export
- Schema/migration tests meet mutation 85+ (0 NoCoverage) and patch coverage 85+; `pnpm check` green
- No UI; `src/core` stays pure; no new dependencies

## Risks

- **Security:** GPS is PII — must remain absent unless the user opts in; site export MUST strip/omit it (spec now; enforcement when export lands)
- Migration must not invent capture/GPS/meta for existing v2 assets
- `BookSummary` / FSA+memory list churn — keep title default narrow and fixture-centralized
