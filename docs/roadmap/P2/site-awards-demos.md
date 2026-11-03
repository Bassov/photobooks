# site-awards-demos

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item site-awards-demos

## Scope

- [ ] Kit-only DEMO branch (never merged; draft PR `[DEMO, do not merge]`): five demos of the photographer's personal site at "awards" level, entry `#/full/site-demos` listing `#/full/site-demo-1` … `#/full/site-demo-5` (2–5 "coming" until built).
- [ ] Demo 1 `#/full/site-demo-1` = Designer Spec `photobooks-orch/shared/design/site-awards/spec.md` Items 1 and 2: site theme `[data-surface="site"]`, true Lora italic, `Book3D` (spine, thickness, true relative sizes, hover poses), home (masthead, hero, shelves, About, dark footer, scroll reveal, cursor label), book page with `BookReader` (rigid page turn 800 ms with shadows, click / ← → / drag, cover open 1000 ms, reduced motion crossfade), all spreads grid, Next book, shelf → book view transition, fullscreen reading.
- [ ] Lane: new files under `uikit/src/features/site-demo-1/` only; `site-viewer.tsx`, `library.tsx`, `#/demo` and `#/full/site-photographer` unchanged; no new dependencies.
- [ ] Kit qa: one smoke `site-demo-1` (shelf → book page → open cover → turn a page → fullscreen); kit qa + typecheck green.
- **Browser check:** at 1440×900 `#/full/site-demo-1`: the reader book is 896×560 (portrait), fullscreen 1248×780; page turn by click, ← / → and drag; reduced motion = 160 ms crossfade.
