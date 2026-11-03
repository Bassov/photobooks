# master-spread-both-pages

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item master-spread-both-pages
Status: done

## Scope

- [ ] A master (parent spread) applied to a two-page spread shows on BOTH pages: layout grid, frames, guides. Root cause found and fixed once in the shared path, not per surface
- [ ] Single-page spreads (first, last) keep working: the master applies to the one page that exists, no crash, no phantom page
- [ ] Core unit tests: master with grid + frame + guide on a two-page spread → both pages resolve it; on the first / last single-page spreads → the one page resolves it
- [ ] Playwright e2e on `?fixture=painter`: new master with a grid applied to a two-page spread → grid overlay on both pages (DOM count / positions / topmost hit, no screenshots); same for a single-page spread
- **Bug rule:** every caller of the apply / resolve path (canvas grid, guides, snapping, thumbnails, presentation, export / preview) is listed in the PR body as fixed or left out with a reason
- **Done when:** unit + e2e above green; typecheck + unit green; full e2e at the end
- **Perf:** N/A — one absolutely positioned wrapper per mounted spread
- **Browser check:** `/?fixture=painter`: Masters → New master → Columns 3 → spread 2–3 → Master = it → Grid on: columns on both pages, over the frames; same on page 1
- **Hard nos:** no `uikit/` edits; off limits `uikit/src/sandbox/chrome.tsx`, `uikit/src/sandbox/viewport.tsx`, presentation overlay files, `uikit/src/features/site-*`, `library.tsx`, `docs/roadmap/RULES.md`, roadmap tooling; no default-master work (follow-up item)
- **Source:** Owner 2026-11-04 (`2026-11-04-master-spread-left-only.webp`: spread 2–3 shows the master grid on page 2 only)
