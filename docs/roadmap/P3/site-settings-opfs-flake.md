# site-settings-opfs-flake

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-settings-opfs-flake
Status: done

Flaky e2e (CI run 43633889412 on #612): `e2e/site-settings.spec.ts` "the site fields save on commit, survive a reload and feed Preview and export" failed once with `NotReadableError: The requested file could not be read` in `storedSite`, which reads OPFS `photobooks-e2e-library/library.json` with `getFile().text()` while the app rewrites it (`createWritable` → `close` replaces the file under a `File` snapshot taken before the close).

## Scope

- [x] Product: the library folder adapter (`src/project/fsa/handles.ts` `getText`) reads a file again from a fresh `getFile()` snapshot when the read fails with `NotReadableError` (a writable closed over the file after the snapshot), bounded attempts; every product reader of `library.json`, `book.json`, `published.json` goes through it. Unit test overlaps a read with a write (fails before, passes after).
- [x] e2e: one shared OPFS text reader in `e2e/fixtures/` treats a mid-write `NotReadableError` as "not ready yet" (sentinel the poll keeps retrying); `storedSite`, `exportedHome` (site-settings) and `readTestLibraryJson` (design-r2-layout-picker) use it. Assertion values unchanged.
- PR body lists every OPFS read caller (product and e2e helper) as fixed or left out with a reason, and states the root cause.
- Hard nos: no assertion weakened, no timeout raised; no `uikit/**`, `e2e/kit-*.spec.ts`, `src/editor/HostingSection.tsx`, `src/editor/hostingBits.tsx`, `src/editor/print/**`, `src/editor/EditorTopBar.tsx`.
- **Done when:** root cause in the PR body; the overlap unit test fails before and passes after; `pnpm exec playwright test e2e/site-settings.spec.ts --repeat-each=10` green locally (one run).
- **Browser check:** N/A (storage read path; covered by the site-settings e2e run above).
