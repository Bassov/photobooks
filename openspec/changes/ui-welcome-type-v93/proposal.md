## Proposal

Roadmap: `docs/roadmap/M3/ui-welcome-type-v93.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/screen/first-run`.

### Scope out

- Library / Settings / Create / Editor chrome (packages K–N)
- Swapping Inter/Lora families or fixing weight via 500/bold

### Delta / Risk

- E2e/unit: Welcome empty happy (h1 weight 400 + `<em>` italic face present); Create Library open/cancel still works; no page H/V scroll
- Fonts: add latin / latin-ext / cyrillic Lora italic woff2 only (same subsets as roman); `font-synthesis: none` stays if faces load
