## Decisions

1. Copy className gains `data-[hovered]:text-foreground!`: the resting `text-muted-foreground!` is `!important`, so only an `!important` hovered variant (React Aria `data-hovered`) can switch the ink. Tokens: `foreground` / `muted-foreground` from `docs/design.md`; the hover fill stays the Button ghost one.
2. The `XS_GHOST` doc comment in `hostingBits.tsx` names the hover ink so the next xs ghost user gets it right.

## Touch-set & Test Plan

| Path                             | Why                                     |
| -------------------------------- | --------------------------------------- |
| `src/editor/HostingSection.tsx`  | Copy hover ink                          |
| `src/editor/hostingBits.tsx`     | `XS_GHOST` comment                      |
| `e2e/design-r27-hosting.spec.ts` | hover ink + unchanged fill, paint check |

- Reuse: `expectXsGhost`, `darkest`, `pixelsAt` in the spec.
- Tests: e2e M114/M115/M120 case hovers Copy, checks computed and painted ink rgb(57,55,56) ±2 and that the hovered background is the ghost hover fill, the same before and after the change (computed and a painted corner pixel); resting checks and h2 y 550.91 stay. No unit change (className only).
