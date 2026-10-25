## Proposal

Roadmap: `docs/roadmap/M2.6/ui-welcome-v93.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/screen/first-run`, `uikit#/demo`.

### Scope out

- Library empty/grid, editor, settings, site, unsupported-browser (Package E)
- Adding `lucide-react` to the app (use in-repo `Icon`)

### Delta / Risk

- E2e lock-ins: empty Welcome (hero + Create Library + plain `screen-credit`); primary click opens FSA / cancel stays Welcome; success → library; no page H/V scroll
- Security: FSA choose/regrant unchanged; only copied CC BY-SA hero + attribution (no new deps)
