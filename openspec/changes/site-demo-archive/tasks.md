## 1. Archive

- [x] 1.1 Merge `origin/fix/site-stand`, `site-awards-demos`, `site-fresh-a`, `site-fresh-b`, `site-fresh-c` (merge, no rebase); keep every route in `features/pages.tsx` and `kit/pages.json`
- [x] 1.2 Restore the demos the stand dropped from their last commit (1–5, 8 from #440; 7 from `b5e5addc^`; fresh C and `site-book/pager` from `66a019ea^`)
- [x] 1.3 Index `#/full/site-archive` (`features/site-archive/index.tsx`): name, source, idea, Desktop + Phone (390 × 844 frame) per demo; linked from `#/full/site-demos`

## 2. Self-check

- [x] 2.1 `e2e/kit-site-archive.spec.ts`: 12 rows; every Desktop and Phone link opens its demo, centre paint, no console errors
