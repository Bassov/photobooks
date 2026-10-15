# Design

## Context

See proposal.md. `Filmstrip` window items set `name` to the asset id and pass it to `FilmstripItemView` as `textValue`, which is the thumbnail’s accessible name. `mintAssetId` sanitizes the id. Import already stores `File.name` on `AssetSessionMeta.name`. `subscribeBookStore` fires on meta flushes; `subscribeGallery` does not. `getGalleryAspectsSnapshot` is the existing referentially stable meta-aware snapshot.

## Goals / Non-Goals

**Goals:** label from session file name, falling back to the asset id; refresh on a late meta flush without changing gallery ids.

**Non-Goals:** id minting, a visible filename caption, new scrollports, sort/filter.

## Touch-set

- `src/editor/bookStore.ts` — `getAssetDisplayName` and `getGalleryDisplayNamesSnapshot` (gallery-ordered, stable while gallery and `sessionMeta` identities are unchanged)
- `src/editor/Filmstrip.tsx` — window item `name` from that snapshot, not the asset id
- `src/editor/FilmstripItem.tsx` — unchanged; still sets `textValue` from the `name` prop. Item `id` / drag payload stay the asset id
- `src/editor/gallery.test-helpers.ts` — optional display name on `seedGallery` so tests do not copy store setup
- `src/editor/Filmstrip.test.tsx` — public `Filmstrip` render: Cyrillic session name is the accessible name; missing name falls back to the id
- `src/editor/bookStore.test.ts` — snapshot identity stable when meta is unchanged; name update notifies
- `e2e/filmstrip.spec.ts` — non-ASCII `setInputFiles` name; reuse `photoFixturePaths.samplePng` bytes
- `docs/roadmap.md` — one unchecked item after `drag-swap-unplace`; tick at archive

## Decisions

1. **Label source in the store snapshot, rendered by the existing item.** `Filmstrip` already subscribes for aspects. A second stable names snapshot keeps the label in sync when meta arrives after the gallery id. Alternative (read `getBookStoreSnapshot()` inside the item) rejected: a new object each call breaks `useSyncExternalStore`.
2. **Blank or missing name falls back to the asset id.** A present non-empty `sessionMeta.name` wins, including Cyrillic and spaces. Do not change `mintAssetId`.
3. **No new caption.** The accessible name is the existing `textValue`. No extra visible filename text.
4. **Do not extend Stryker allow-lists.** `bookStore.ts` is already in `scripts/stryker-diff.mjs` and `stryker.config.json`. `Filmstrip.tsx` stays out of that allow-list.

## Tests

| Surface      | Public API                       | Assert                                                                                                        |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Unit         | `Filmstrip`                      | Session meta name `фото отпуск 01.jpg` equals the thumbnail accessible name; missing name equals the asset id |
| Unit         | `getGalleryDisplayNamesSnapshot` | Same array while meta identity is unchanged; new name after meta update                                       |
| E2E empty    | existing empty filmstrip test    | Copy “Add a folder or photos to build the gallery.”; no item                                                  |
| E2E happy    | import via `photo-file-input`    | Accessible name is the non-ASCII file name, not `asset-…`                                                     |
| E2E interact | activate that thumbnail          | `aria-selected`; `assertDocumentFitsViewport`                                                                 |

Reuse `seedGallery`, `photoFixturePaths`, and `assertDocumentFitsViewport`. No new scrollport, so no `assertNamedScrollport` change. Skill `ui-review` (including layout smoke) runs before push.

## Risks / Trade-offs

- [Name refresh tied only to gallery ids] → names snapshot subscribed on `subscribeBookStore`
- [Accessible name diverges from drag id] → `textValue` changes; `id` and drag MIME stay the asset id
