# filmstrip-stuck-thumbs

Tag: feature
Milestone: P2
Title: Bug: after a fling back and forth some filmstrip tiles never get a thumb
Status: done

## Scope

- [ ] A thumb decode cancelled when its tile leaves the now set (Owner 2026-11-02: fling back and forth during import) always reaches the tile again: the pool retry on re-entry publishes its result through the import owner, and an import job cancelled before it starts retries without the stale abort signal
- [ ] Every caller of the thumb request / cancel / retry path (`useThumbUrl`, `thumbMissDecode`, `filmstripVisibleSync`, `filmstripWindow`, `thumbCache`, decoder pool) is fixed or listed as left out with a reason in the PR body
- **Done when:** `e2e/filmstrip-stuck-thumbs.spec.ts` (fling during and after import) fails on `origin/main` with N stuck tiles and passes on head: 0 placeholders in the scrollport within 5 s after the strip stops; `--repeat-each=10 --retries=0` green; existing thumb / filmstrip e2e green
- **Perf:** no LoAF from our code in the new scenario; perf lane not worse than main
- **Browser check:** import a 1000-JPEG folder, fling the strip back and forth during and after the import, stop: every tile in view shows its thumb within 5 s
