## Decisions

1. Root cause: `ObjectUrlLru` (tier cache, cap 48) and `thumbCache` revoke an evicted or replaced URL at once, while a mounted `<img>` still holds it in `src` / `srcset`; the next fetch (remount after a swap, srcset switch, reload restore) fails.
2. `revokeObjectUrlWhenUnused(url)` in `src/lib/objectUrlRevoke.ts`: revoke now unless an element's `src` / `srcset` / `style` holds the URL, else keep it pending and re-check every 1 s while any are pending. The DOM is the reference source, so no per-consumer refcounts. No `document` → revoke now.
3. Perf: the referenced set is one `querySelectorAll('[src^="blob:"], [srcset*="blob:"], [style*="blob:"]')` per task (cleared in a microtask); revokes run in cache flushes, not in pointer handlers. The item has no perf gate.
4. Memory: caches drop entries at once (caps unchanged); only on-screen URLs outlive eviction, bounded by virtualization.
5. Security: no new URL sink; a held URL stays same-origin.
6. Routed: `objectUrlLru`, `thumbCache.removeEntry`, `revokePhotoPreview`, `useCachedCoverUrl`. Left out: `openPrintedPdf` (other tab, 60 s timer), `derivatives/lab` (dev page, never revokes).

## Touch-set & Test Plan

| Path                                 |
| ------------------------------------ |
| `src/lib/objectUrlRevoke.ts`         |
| `src/lib/objectUrlRevoke.test.ts`    |
| `src/photo/objectUrlLru.ts`          |
| `src/photo/objectUrlLru.test.ts`     |
| `src/editor/thumbCache.ts`           |
| `src/editor/thumbCache.test.ts`      |
| `src/photo/loadPhoto.ts`             |
| `src/editor/useCachedCoverUrl.ts`    |
| `e2e/blob-url-revoke.spec.ts`        |
| `docs/roadmap/P5/qa-blob-revoked.md` |

- Unit (fail on main): eviction / replace of a URL held by a mounted `<img>` is not revoked until the element goes; LRU `size` stays at capacity.
- e2e: ≥12 photos, swap drags, save, reload, reopen: 0 `requestfailed` on `blob:`.
