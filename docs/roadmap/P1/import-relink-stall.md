# import-relink-stall

Tag: feature
Milestone: P1
Title: Bug: photo import stalls at 16 / 21 and a relink dialog opens during import
Status: done

## Scope

- [ ] A failed IDB write of the photo folder binding no longer aborts a folder import after the first batch (r14 prod walk: stall at 16 / 21 and a relink dialog during import)
- [ ] All 21 photos land, progress clears, no relink dialog opens while photos are still importing; a status says the folder must be added again after reload
- **Done when:** `e2e/import-relink-stall.spec.ts` fails on `origin/main` and passes on head with `--repeat-each=10 --retries=0`; perf lane green
- **Browser check:** import a 21-photo folder with the root-store IDB write failing: 21 thumbs, no relink dialog, no page errors
