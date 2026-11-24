# site-demos-port

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item site-demos-port

## Scope

Port the archived personal-site demos of DEMO PRs #557 (`fix/site-demo-archive`) and #508 (site-stand) onto current main as a clean kit section; rebuild on today's kit, do not merge those branches.

- [ ] Own kit nav section "Site demos (archive)", reachable from the kit home; its index lists each demo and says it is an archive, not a design source; demos are not design-source feature pages.
- [ ] Bookcase (demo 9) stays main's personal site; the archive carries only what main lacks, no duplicate of main's site code.
- [ ] Reuse main's kit helpers and fonts; no `openspec/changes/site-*` or P3/P5 demo item files; `uikit/scripts/qa.mjs` unchanged; no `src/**` diff.
- [ ] `e2e/kit-site-archive.spec.ts`: section visible, index opens, each demo renders with 0 console errors.
- **Browser check:** kit home → Site demos (archive) → each demo opens without console errors.

## Done when

Archive section reachable from the kit nav, all ported demos open with 0 console errors (e2e), uikit build + kit e2e green, no qa.mjs diff, no `src/**` diff.
