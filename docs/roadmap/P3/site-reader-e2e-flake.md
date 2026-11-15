# site-reader-e2e-flake

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item site-reader-e2e-flake

## Scope

- [x] Find the cause of the two intermittent PR-CI reds: `e2e/kit-personal-site.spec.ts` "D38 / D41 / K2 … the case at a 390 px root" (`ss-next` click past the 30 s timeout) and `e2e/kit-personal-site-reader-gl.spec.ts` "T1: the landing leaf shows its own page" (`settle()` still on view 0 after 5 s).
- [x] Fix the product (kit and prod readers as needed) or the test without loosening assertions, adding `waitForTimeout` or raising the global timeout.
- **Done when:** the PR body gives the cause of each failure with trace / log evidence and what was fixed; both tests pass 20/20 locally with `--repeat-each=20` and the other tests in both spec files pass; every caller of a changed reader function is listed as fixed or left out with a reason.
- **Browser check:** the kit `#/demo` site reader turns Cover … Back cover under reduced motion and the `#/full/personal-site` GL reader opens a book onto view 1, both with the crossfade still fading old → new.
