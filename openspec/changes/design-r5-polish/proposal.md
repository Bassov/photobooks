## Proposal

Roadmap: [docs/roadmap/P1/design-r5-polish.md](../../../docs/roadmap/P1/design-r5-polish.md). UI ref: `uikit#/demo` steps 16–18, editor top bar.

### Scope out

- Other chrome buttons whose utilities lose to `.pb-button`; `App.tsx`, `uikit/`.
- The capture script (M43 is prod, not a capture artifact).

### Delta / Risk

- skip_specs: true (drop-target contract unchanged).
- e2e: empty (no drag: ring, no chip), happy (held drag), restore (Escape/up, self-drop), top bar.
