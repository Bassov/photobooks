## Proposal

Roadmap: `docs/roadmap/P5/e2e-paint-probe.md` (scope / Done when SoT).

### Scope out

- Screenshot baselines (`toHaveScreenshot`): visual-regression-e2e backlog item.
- Other hand-written hit probes (guides-overhang, arrange-lock, framestyle-arrange, parent-spreads\*).
- Any `src/` or `uikit/` change.

### Delta / Risk

- skip_specs: true.
- `topAt` hits empty pointer-events:none wrappers too; asserts compare stack order.
