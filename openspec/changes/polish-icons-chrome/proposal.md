## Proposal

Roadmap: `docs/roadmap/P5/polish-icons-chrome.md` (SoT; UI ref `uikit#/demo`).

### Scope out

- P10 warm chrome (follow-up polish-warm-chrome).
- Lane-locked pins (`e2e/design-r11-topbar.spec.ts`, #680): listed in the PR.

### Delta / Risk

- e2e locks the happy path: Publish rest / hover / focus / running, icon stroke by size, dot paint; no empty or scroll change.
- Publish narrows 4 px, so the cluster x pins move.
