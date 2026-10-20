# home-app-mutation

Tag: prep
Milestone: M2.1
Title: mutate HomeScreen.tsx and App.tsx (issue #72 B)

## Scope

- [ ] Remove the `temporary` entries for `src/editor/HomeScreen.tsx` and `src/App.tsx` (excluded since PR #71 with no owning item)
- [ ] RTL tests on the shared fake project-session store from `editor-shell-mutation`: home empty / list / error / busy / keyboard, surface switch and bootstrap in `App.tsx`
- [ ] Product polish stays in M2.2 `recents-home-quality`; this item only adds tests and test seams
- **Done when:** both files are mutated on both runs at 85+ with no NoCoverage.
- **Size:** ~700 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 B; gap audit
- **Reason:** Home/App markup is slated for M2.2/M2.5 uikit adoption; mutation RTL before that rewrite is throwaway (pipeline-gates opt §3.1, owner 2026-10-20).
