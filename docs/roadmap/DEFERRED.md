# Deferred (not scheduled)

- rtk adoption (`rtk-oss` + Cursor hook + `.rtk/filters.toml`), deferred by owner 2026-10-18; the quiet scripts stay the baseline; issue #79 §5
- Rating / reject culling (the gallery itself is the selection)
- HEIC input (libheif WASM), "consolidate originals" command, library export to a single archive
- PDF/X, ICC output intents, CMYK
- Additional publish targets beyond Cloudflare (GitHub Pages, S3, …)
- Loaded-cursor place queue (←/→ to pick, click to place) — revisit at the M3 review cut
- Autoflow op (`autoflow-op`): pure op placing photos into empty frames from a start spread, cloning the chosen or best-fit template (`template-slot-aspects`) onto new spreads until photos run out; filled frames skipped; PBT invariants, `pnpm bench` budget for 200 photos
- Autoflow UI (`autoflow`): "Autoflow selected / unplaced" from the filmstrip and toolbar, fixed or best-fit template, result is one history step; gate: autoflow 200 photos into the fixture book — zero LoAF
- Content-aware crop center (faces / saliency in a worker)
- Non-destructive adjustments (B&W, warmth) with DOM / PDF parity
- Data merge (CSV / JSON → captions and order); scripting API over `BookOp`
- IDML import; changing trim size with automatic layout rescale
- Firefox smoke e2e (#50 item 8): a Firefox Playwright project running the specs that need no File System Access (home without a library, `?fixture=` editor views); revisit when the app gets a non-FSA storage path or at the M8 review cut
- Not planned (**Owner-confirm**, Designer call M6 2026-10-30): photo Adjust (brightness / contrast / saturation, kit `AdjustSection`) and Flip H / V (kit `PhotoRotateSection`); hidden in the product inspector
