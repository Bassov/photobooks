# uikit-sync

Tag: prep
Milestone: M2.6
Title: Import Designer-approved UI kit v0.9.3 into uikit/
Status: done

## Scope

- [x] Replace in-repo `uikit/` with Designer-approved kit **v0.9.3** (standalone package; app never imports `uikit/src`)
- [x] Kit routes available: `#/demo`, `#/full/<id>`, `#/screen/<id>`, `#/feature/<slug>`
- **Done when:** `uikit/` on main is v0.9.3; kit typecheck/build green in its package; product still asserts `assert:no-uikit-in-app`
- **UI kit:** `UI ref: uikit#/demo` — end-to-end kit prototype; `UI ref: uikit#/full/editor` — bare editor demo
- **Size:** docs/import only (package A)
- **Source:** Owner package A (merged #204)

## Done note

Shipped as chore(uikit): replace public kit with v0.9.3 (#204); package A.
