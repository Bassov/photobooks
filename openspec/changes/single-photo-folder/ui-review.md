# UI review — single-photo-folder

## Pass/fail

- **Design system:** PASS — reuses EmptyState, primary Button, quiet Status + Grant; no new tokens/primitives.
- **A11y:** PASS — Choose/Change photo folder and Allow access are keyboard-reachable buttons with accessible names; re-grant distinct from library Grant access.
- **States:** PASS — importDisabled covers busy/locked; confirm on Change; permission-required shows Allow access.
- **Meaning:** PASS — folder label in Allow access copy; missing falls to existing relink UX.

## Layout smoke

- Empty pasteboard card + filmstrip empty copy covered by `e2e/editor-empty-hints.spec.ts` (`assertDocumentFitsViewport`).
- Happy folder import + scrollport: Manual scenario 1 + empty-hints/filmstrip e2e.

## Anti-slop

- PASS — placeholder chrome only; no new visual system.
