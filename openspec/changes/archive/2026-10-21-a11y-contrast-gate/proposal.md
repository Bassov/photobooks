## Proposal

Roadmap: [`docs/roadmap/M2.5/a11y-contrast-gate.md`](../../docs/roadmap/M2.5/a11y-contrast-gate.md) (scope / Done when SoT). Prep fast-track; `skip_specs: true` (e2e axe gate + token contrast; no domain contract). UI ref: `uikit#/feature/design-tokens`.

### Scope out

- Full `@axe-core/playwright` adoption and multi-surface matrix from `docs/backlog/axe-e2e.md`
- Dark-theme dual-run (later `dark-theme`)
- New npm dependency (`axe-core` via existing `@lhci/cli` resolve)

### Delta / Risk

- E2e lock-ins: `?specimen` (empty design system), editor empty (`openSessionEditor`), happy editor (`?fixture=painter`) — axe color-contrast AA + name/role; violations fail the suite/CI.
- Bang-excluded shells (`EditorShell` / `HomeScreen` / `App`): contrast fixes go through tokens/CSS only; do not edit those files.
