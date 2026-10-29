# assets-panel

Tag: feature
Milestone: M3
Title: book assets at a glance
Status: done

## Scope

- [ ] Assets view v2 in a `Panel`: thumbnail, name, status (ok / missing / modified), uses, spreads; sort by status / uses (the effective-DPI column arrives with `dpi-badge` in M6)
- [ ] Jump to frame; Update a modified asset (refresh previews, keep crop)
- **Perf:** virtualized rows; row data from selectors via `startTransition`. Gate: 1000-asset book, scroll the panel and sort by status — zero LoAF.
- **Browser check:** retouch a placed photo on disk — it shows as modified, Update refreshes it in place with the crop kept; clicking a row jumps to its frame.
- **UI ref:** `kit v0.9.3 #/feature/assets-panel (removed in kit v0.10.0, no replacement)`
- **UI kit:** none in v0.10.0 (kit v0.9.3 `#/feature/assets-panel (removed in kit v0.10.0)`, removed) — assets list: status, uses, jump, Update

## Done note

dropped: Owner decision, no Assets surface (filmstrip covers it)
