## Proposal

Roadmap: `docs/roadmap/M4/topbar-kit-parity.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit/src/sandbox/chrome.tsx`.

### Scope out

- Export, Publish, masters, cover/endpaper, guides, photo-rotate, multi-select, Align.
- New zoom math or camera logic; `src/render/*`.

### Delta / Risk

- Top bar: no placeholders, Preview pill, − / zoom menu / +, `h-12` no-wrap kit order; CameraBar strip removed. Observables e2e locks in: empty (camera strip absent, no placeholders), happy (200% → "200%", Fit spread → "Fit", Preview enters presentation), interact (menu key hint). No scrollport change.
- Risk: fit actions live in the pasteboard hook, so a tiny command registry in the camera store bridges them. No security surface.
