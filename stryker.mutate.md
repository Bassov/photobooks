# Mutation excludes

Each `!` pattern in `stryker.config.json` `mutate` has one reason here. JSON cannot hold comments.

- `!src/**/*.{test,spec}.{ts,tsx}` — tests are not production code
- `!src/**/*.{bench,benchmark}.{ts,tsx}` — benches are not production code
- `!src/**/*.d.ts` — declarations have no runtime behavior
- `!src/**/*.test-helpers.ts` — test helpers are not production code
- `!src/core/testing/**` — fixtures for tests
- `!src/core/index.ts` — re-exports only
- `!src/project/index.ts` — re-exports only
- `!src/main.tsx` — Vite entry
- `!src/photo/photo.worker.ts` — onmessage wrapper; logic lives in processPhoto.ts
