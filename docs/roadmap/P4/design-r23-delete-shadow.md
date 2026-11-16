# design-r23-delete-shadow

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item design-r23-delete-shadow
Status: done

## Scope

Designer parity printer-presets p2 (Round 23, M100 carry-over): the AlertDialog destructive confirm paints no shadow; kit `shadow-xs`.

- [x] `box-shadow: var(--shadow-xs)` on `.pb-button--destructive` at rest and hover; `none` while pressed (kit Button destructive).
- [x] Every destructive Button use listed in the PR body (all share the class through `AlertDialog`).
- **Done when:** the Delete-profile confirm Delete has the kit box-shadow at rest, none while pressed, and a paint check shows the row under it darker than the dialog; Cancel (ghost) stays `none`.
- **Browser check:** `e2e/printer-presets.spec.ts` "row actions, the Default badge and the delete confirm paint like the kit".
