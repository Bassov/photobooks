# rescan-cheap-verify

Tag: prep
Milestone: P1
Title: Folder rescan on open: no per-file re-resolve, O(n) diff, parallel scan
Status: done

## Scope

- [ ] Scan walk (`src/assets/scanWalk.ts`, runs in the scan worker): `getFile()` calls run with bounded parallelism (about 16 per directory) instead of one by one.
- [ ] `startFolderRescan` (`src/editor/photoRootSession.ts`): do not `resolveFile` every gallery asset on open (a path walk plus `getFile` per file on the main thread, although the scan already called `getFile` for each). Take the `File` objects from the scan (cloning a File copies no bytes), or resolve right before a decode needs the file. Identity patching from the scan (size / mtime) stays as is.
- [ ] Replace the O(n²) lookups in `startFolderRescan` (`priorityWithChanges.some`, `indexDiff.newPaths.includes`, `book.gallery.find` per changed path) with Sets / Maps.
- [ ] Spec delta `asset-source` only if the priority-verify contract changes.
- **Done when:** the large-folder responsiveness harness (3–4k synthetic files) stays green and its rescan wall time drops (before / after in the PR body); used-in-book entries still finish before the unused remainder; add / remove / change detection green (`e2e/photo-folder-regrant.spec.ts`, rescan unit tests).
- **Test:** unit (diff lookups, scan parallelism) + existing harness and e2e
- **Hard nos:** no change to the identity key (path + size + mtime); the walk still runs on every open
- **Depends:** thumb-reload-cache-miss, folder-manifest-batched-dims
