## Decisions

1. Retry in the adapter, not per caller: `getText` in `src/project/fsa/handles.ts` re-snapshots (`getFile()` again) and reads again when `text()` rejects `NotReadableError`, up to 4 reads; other errors and the last failure propagate unchanged. Security: no new handles or permission requests; the retry only re-reads a handle the adapter already holds.
2. The browser fake models the Chromium rule: each file has a version, bumped by `close()` / `writeFile` / `removeEntry`; a `File` snapshot's `text()` / `arrayBuffer()` rejects `NotReadableError` once the version moved. An `onSnapshot(name, hook)` hook lets a test commit a write between snapshot and read.
3. e2e: `e2e/fixtures/opfsText.ts` `readOpfsText(page, path)` returns the text or `OPFS_MID_WRITE` on `NotReadableError`; poll callers keep polling, assertion values unchanged.

## Touch-set & Test Plan

| File                                               | Why                              |
| -------------------------------------------------- | -------------------------------- |
| `src/project/fsa/handles.ts`                       | re-snapshot read                 |
| `src/project/fsa/handles.test.ts`                  | overlap + give-up + other errors |
| `src/project/fsa/browserDirectory.test-helpers.ts` | snapshot versions, hook          |
| `e2e/fixtures/opfsText.ts`                         | shared mid-write-aware reader    |
| `e2e/site-settings.spec.ts`                        | `storedSite`, `exportedHome`     |
| `e2e/design-r2-layout-picker.spec.ts`              | `readTestLibraryJson`            |

- Unit: read overlapped by a committed write returns the new text (fails before); persistent overlap rejects `NotReadableError` after 4 snapshots; `NotFoundError` is not retried.
- e2e: `site-settings.spec.ts --repeat-each=10`.
