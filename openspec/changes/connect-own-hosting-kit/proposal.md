## Proposal

Roadmap: `docs/roadmap/P5/connect-own-hosting-kit.md`. Designer Spec `connect-own-hosting`. UI ref: `uikit#/feature/site-settings`.

### Scope out

- Relay, core and prod UI (later items); provider select (C5).
- `uikit/scripts/qa.mjs`, `#/demo` walk and baselines.

### Delta / Risk

- e2e: empty = setup step 1; happy = token → address → Set up → connected card; interact = error → Try again → Forget. No page-level H/V scroll: the settings `main` stays the only scrollport.
- Security: kit simulation, no network; the setup token never reaches React state, the DOM or the URL.
