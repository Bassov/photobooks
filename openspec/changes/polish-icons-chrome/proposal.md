## Proposal

Roadmap: `docs/roadmap/P5/polish-icons-chrome.md` (scope / Done when / Browser / Perf SoT). Designer spec walkthrough-polish-review P6, P8, P9; UI ref `uikit#/demo` (editor top bar).

### Scope out

- P10 warm neutral chrome (follow-up polish-warm-chrome; palette pins sit in files held by #679 / #680).
- Pins in lane-locked files (`e2e/design-r11-topbar.spec.ts`, #680): listed in the PR for the follow-up.

### Delta / Risk

- e2e lock-ins: happy = Publish ink pill at rest / hover / focus-visible / running on prod and `#/demo`; icon stroke by rendered size; canvas dot paint .30. No empty or scroll state changes.
- The Publish rest width drops 4 px (inset 14 → 12), so the right cluster's x pins move 4 px right.
