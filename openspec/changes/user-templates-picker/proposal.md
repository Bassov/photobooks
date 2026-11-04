## Proposal

Roadmap: `docs/roadmap/P3/user-templates-picker.md` (scope / Done when / Browser). UI ref: Designer spec `user-templates` UT1 picker, UT2–UT4.

### Scope out

- Best fit over own templates (`user-templates-best-fit`).
- Store / `library.json` schema (shipped by `user-templates-store`).

### Delta / Risk

- Observables: empty / happy / Save-twice flash. Scrolling only inside the Inspector scrollport (`scrollIntoView` nearest), no page-level scroll. The saved-layout requirement is folded into `spread-view` (spec at its 400-line cap).
