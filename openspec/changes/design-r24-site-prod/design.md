## Decisions

1. M106: set the `pt-gl` canvas `visibility` to `'visible'` / `'hidden'` explicitly; `''` falls back to `.pt-gl { visibility: hidden }`, so a drawn canvas stayed hidden over hidden DOM sheets.
2. M107: the over-home cover turn read `port` on mount, before `useViewport` measured (server desk box). Read it at timer time through a `portNow` ref; skip the turn in portrait.
3. M110: the desk room name is `<a className="ss-name" href={homeHref} onClick={closeClick}>` (the "All books" href and handler), `z-index: 2` over the GL canvas like `.sb-all`. The embedded Preview renders no name (unchanged).
4. No new tokens or primitives: `.ss-name` and the `.ss :where(a)` inheritance are reused.

## Touch-set & Test Plan

| Path                                                  | Why                                                    |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `src/site/book/turn.tsx`                              | M106 canvas visibility                                 |
| `src/site/book/room.css`                              | M106 comment; M110 name over the GL canvas             |
| `src/site/SiteRoom.tsx`                               | M107 portrait guard, M110 name link                    |
| `src/site/book/turn.test.tsx`                         | M106 unit                                              |
| `src/site/SiteRoom.test.tsx`                          | M107 / M110 unit                                       |
| `src/site/__snapshots__/renderSitePage.test.tsx.snap` | prerendered name is a link                             |
| `src/site/export/buildSiteTree.test.ts`               | inline snapshot: book page sizes grow (name is a link) |
| `e2e/site-room-parity.spec.ts`                        | M106 / M107 / M110 e2e (new)                           |

- Reuse: `e2e/fixtures/paintProbe.ts` (`pixelsAt`, `topAt`).
