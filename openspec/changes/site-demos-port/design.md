## Decisions

1. Own route `#/archive[/<slug>]`, not `#/full/<slug>`: `#/full` resolves only `pages.json` features, whose rows are design-source pages walked by the frozen `qa.mjs`. KitBar link via `onPress` (no `href`), like Walkthrough.
2. One folder `site-archive/` on main's `site/*` and `site-book/*` helpers; the branch's `site-demo-1` / `site-sys` copies are dropped. Kept local: `v2.tsx`, `pager.tsx`, `fullscreen.tsx`.
3. Demos 6–8 use main's `SysSite` via `sys.tsx`; dark wall and Books switch in `sys.tsx` + scoped `archive.css`.
4. Demo 9 = main's personal site: its row links `#/full/personal-site`.
5. New fonts only for Lora italic (scoped family) and Inter opsz italic.
6. UI: KitBar and kit semantic tokens (`bg-background`, `bg-muted`, `text-muted-foreground`, `rounded-3xl`); skill `ui-review` before push.

## Touch-set & Test Plan

| Path                                             | Why                |
| ------------------------------------------------ | ------------------ |
| `uikit/src/kit/router.ts`                        | route              |
| `uikit/src/kit/Shell.tsx`                        | nav link           |
| `uikit/src/main.tsx`                             | dispatch, title    |
| `uikit/src/features/site-archive/index.tsx`      | index, demo, phone |
| `uikit/src/features/site-archive/sys.tsx`        | shell adapter      |
| `uikit/src/features/site-archive/archive.css`    | scoped extras      |
| `uikit/src/features/site-archive/v2.tsx`         | v2 parts           |
| `uikit/src/features/site-archive/v2.css`         | v2 type            |
| `uikit/src/features/site-archive/pager.tsx`      | fresh C pager      |
| `uikit/src/features/site-archive/fullscreen.tsx` | demo 1             |
| `e2e/kit-site-archive.spec.ts`                   | e2e                |

Also in scope: `site-archive/demo-*/`, `fresh-*/` (branch bodies, imports rewired) and four new `uikit/src/fonts/*italic*.woff2`.

e2e (kit has no unit tests): happy = nav → index, 12 rows in order, archive note, demos absent from `__kit.pages`; interact = each demo desktop + phone paints at centre, 0 console errors; empty = unknown slug → `not-found`.
