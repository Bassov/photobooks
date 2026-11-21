# design-r38-badge-reveal-kit

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r38-badge-reveal-kit

Designer parity Musts M146, M147 (Round 38, placed-badge) and M149 (Round 39, frame-context-menu p2). Kit-only fix in `uikit/src/sandbox/`.

## Scope

- [ ] M146: after a placed-badge jump the kit reveals the frame per axis: if it fits in the port (visible area right of the spread list) inset by 24 px, scroll the minimum that puts it inside; if it is larger, centre it on that axis. e2e: a target that starts under the spread list ends with frame left ≥ spread-list right + 24 and scrollLeft changes; at 2× a horizontally fitting frame ends fully inside the port.
- [ ] M147: every jump path (click, Enter, double-click) clears the filmstrip selection, as in prod (Spec Jump step 6). e2e: selection empty after each path.
- [ ] M149: the kit status line shows a visible pill only for prod's four visible kinds (`src/editor/editorStatus.ts`); every other status (pick-replace, filmstrip drop) is screen-reader only. e2e: no visible pill after pick-replace and filmstrip drop, text still in the live region; a visible kind still shows a pill.
- **Browser check:** kit e2e (`pnpm test:e2e:quiet e2e/kit-`).
