## Proposal

Roadmap: `docs/roadmap/P1/design-r10-library.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/demo`.

### Scope out

- Global `button` rules, Settings nav "Library" (M58), editor, dialogs.
- Global `--text-xs` / `--text-sm` line-height tokens.

### Delta / Risk

- e2e per the roadmap Browser check; no page scroll, Settings scrolls only in `settings-scroll`.
- Risk: kit-parity italic is Chrome's synthesized oblique (kit ships upright Lora only); book content keeps real italic.
