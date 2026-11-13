## Decisions

1. Drop `dark` from `ClosedOptions` and `OpenLook`; inline the light constants; no theme parameter replaces it.
2. Dark-only tests are removed or rewritten on the light path: the closed contact-shadow test checks the light half-lift fill (0.21); the floor-off assertion moves into the existing "poses without a floor and disposes everything once" test.

## Touch-set & Test Plan

| File                                                 | Change                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `src/site/book/gl/closed.ts`                         | drop `dark` option and branches                                  |
| `src/site/book/gl/open.ts`                           | drop `dark` look field and branches                              |
| `src/site/book/book3dGl.ts`                          | drop `dark: false`                                               |
| `src/site/book/roomGl.ts`                            | drop `dark: false`                                               |
| `src/site/book/gl/closed.test.ts`                    | delete dark room test; contact shadow on light; floor-off assert |
| `src/site/book/gl/open.test.ts`                      | delete dark digest                                               |
| `src/site/book/book3dGl.test.ts`                     | comment only                                                     |
| `src/site/book/roomGl.test.ts`                       | look without `dark`                                              |
| `src/site/book/gl/__snapshots__/closed.test.ts.snap` | dark entry removed                                               |
| `src/site/book/gl/__snapshots__/open.test.ts.snap`   | dark entry removed                                               |

- Reuse: existing digests / snapshots lock the light output (no added lines in `.snap`).
- Tests: unit only; no e2e (no visible change).
