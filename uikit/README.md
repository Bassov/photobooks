# Photobooks UI kit

UI/UX reference for Photobooks (package `photobooks-ui-kit` **0.3.1**). One page per roadmap feature that has user-facing UI: live demo (mock data) plus short UX notes.

**`docs/roadmap.md` is the source of truth.** The kit mirrors roadmap slugs, order, and milestone grouping only. When they disagree, the roadmap wins.

## Reference convention

Link from roadmap items, PRs, and issues with:

```
UI ref: uikit#/feature/<slug>
```

Example: `UI ref: uikit#/feature/missing-assets-relink`. In this repo that is `/uikit/#/feature/<slug>` (dev and preview). Legacy `#/f/<slug>` still resolves.

## Run (from repo root)

```bash
pnpm uikit:dev          # kit alone on :5173 (optional)
pnpm dev                # app + kit at http://127.0.0.1:5173/uikit/
pnpm build              # app dist/ then kit → dist/uikit/
pnpm uikit:typecheck
pnpm uikit:qa:quick     # headless checks on dist/uikit (Chrome; set CHROME_PATH if needed)
```

Filter form: `pnpm --filter photobooks-ui-kit <script>`.

## Isolation

- Outside `src/**`: not in unit coverage or mutation file sets.
- App must not import this package (`pnpm deps` + CI bundle assertion).
- `uikit/**` is excluded from the PR size limit (owner decision 2026-10-19).

## Changes in v3.1

- `static-export`: the picked export folder no longer shows a doubled `~/~/` prefix (`src/features/m5m7.tsx`, `setFolder(f)`). Package version 0.3.1.

Photo licences: `PHOTO-CREDITS.md` (all CC0).
