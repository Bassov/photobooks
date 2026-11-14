# design-r27-button-styles

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item design-r27-button-styles
Status: done

## Scope

Designer parity connect-own-hosting 2026-11-14 (Musts M116, M118, M119): shared button and badge styles differ from the kit. `.pb-button--ghost` paints a muted ink (kit ghost has no ink of its own and inherits), the primary hover mixes 90 % primary with foreground (kit `--primary-hover`), and a small dot badge has padding-left 5 px (kit `pl-1`, 4 px). Lane: `src/ui/Button.*`, `src/ui/Badge.*` and their tests, plus a `text-muted-foreground` class on the ghost buttons the kit keeps muted.

- [x] Ghost buttons inherit the parent ink (kit); kit-muted ghosts (zoom menu, Reset to cover, Reset adjustments, Remove from frame) keep the muted ink via a utility class
- [x] Primary (`default`) hover background is `--primary-hover` rgb(58,56,57)
- [x] Small dot badges have padding-left 4 px; plain badges keep their box
- [x] e2e paint check: Hosting Check again / Cancel setup / Forget ink rgb(57,55,56) ±2; two primaries in different screens hover rgb(58,56,57) ±2; Connected badge padding-left 4, width 77.66 ±0.5; Default badge box unchanged
- **Done when:** the cases above pass; existing unit/e2e stay green (an assertion changes only where it pinned the old non-kit value); the PR lists every ghost, primary and dot-badge use as changed, unchanged on purpose or left out.
- **Browser check:** Settings → Hosting: Check again, Cancel setup and Forget read in the dark text ink; hovering Set up hosting / Create book shows the kit hover; the Connected badge sits 1 px tighter on the left.
- **Hard nos:** disabled primaries keep prod's flat grey; nothing in `uikit/**`, the hosting/settings TSX, `src/editor/export/**`, `src/editor/print/**`; no other items' roadmap lines.
