# warm-slice-scheduler-loaf

Tag: feature
Milestone: P2
Title: Bug: CI perf red on main (thumb warm slice / bulk hydrate fling LoAF)

## Scope

- [ ] Fling LoAF in `thumb-warm-slice` / `thumb-bulk-hydrate` frame-budget gates: attribute, then remove our cause (no gate or PERF_BUDGETS change)
- **Attribution (main 426a38c):** every gated entry is one React scheduler task (`D`, `MessagePort.onmessage`, 45–101 ms) holding a V8 major GC finalize (27–53 ms). Garbage: react-aria `GridList` re-renders every mounted filmstrip row on each window shift (~2.3 MB per fling frame) and `getAssetCacheKey` re-hashes SHA-256 on every call (rows, warm lane).
- **Perf:** a filmstrip window shift renders only the rows that enter; a cache key is hashed once per identity.
- **Browser check:** fling the 1000-photo strip after reopen: thumbs fill, click / Ctrl / Shift selection, arrow keys, drag of a multi-selection work as before.
- **Done when:** both gates green locally with `--repeat-each=10 --retries=0` and CI perf 3/3 on the head; PR body has attribution and LoAF counts before / after.
- **Hard nos:** no PERF_BUDGETS or gate change; no weaker asserts; no visual change to filmstrip cards.
- **Test:** unit for cache-key memo and grid selection / keyboard logic; existing filmstrip e2e; both frame-budget gates.
