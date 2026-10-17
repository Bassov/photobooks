# e2e-local-flakes

Tag: prep
Milestone: M2.1
Title: Stabilize local e2e flakes (open-save, filmstrip gaps, template-unplace, drag-place)

## Scope

- [ ] Stabilize local Playwright flakes without weakening assertions, retries, skip, or tolerances
- [ ] `open-save › fresh session Open loads saved book with thumbs and frames`
- [ ] `filmstrip › mixed aspect cards pack with uniform gaps…`
- [ ] `template-unplace › a smaller template unplaces overflow photos…`
- [ ] `drag-place` frame-budget tests (two scenarios under frame-budget gates)
- [ ] `autosave › autosave persists edits across reload without manual Save` (intermittent local)
- [ ] `drag-swap › escape cancels a move source and Delete unplaces a focused frame` (intermittent local)
- [ ] `spread-view › continuous zoom stays within frame-budget gates` (LoAF flake)
- **Done when:** the named tests pass reliably locally (repeat-each / consecutive green runs) and in CI without looser gates
