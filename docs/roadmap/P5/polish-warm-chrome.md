# polish-warm-chrome

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item polish-warm-chrome
Status: done

Designer walkthrough-polish-review P10 "Warm neutral chrome" (Owner Q-21, Q-22); split off polish-icons-chrome (#682). Kit + prod in one PR.

## Scope

- [x] Canvas `#C8CACB` → `#C9C7C3`, chrome `#E1E1E1` → `#E3E1DD`, field `#D7D7D7` → `#D8D6D2`, border `#CDCDCD` → `#CCC9C4`, secondary hover `#CFCFCF` → `#CDCAC5` in kit tokens, prod tokens, prod `BAR` / `FIELD` and their literal copies (kit + prod).
- [x] Text, ink and paper unchanged; site palette, `--cover-empty`, `.hatch-missing` and derived neutrals unchanged.
- [x] Every unit / e2e pin of the old palette moves to the new values with the same intent.
- **Browser check:** prod editor at 1440×900 and kit `#/demo` editor: top bar rgb(227, 225, 221), canvas rgb(201, 199, 195), a field control rgb(216, 214, 210) (paint check in `e2e/kit-warm-chrome.spec.ts`).

## Done when

- `git grep -i "c8cacb\|e1e1e1\|d7d7d7\|cdcdcd\|cfcfcf" -- src uikit/src` finds only the exclusions (site, cover-empty, hatch, book-data tests, history comments).
- Text contrast of `#535152` and `#393738` on chrome and field stays ≥ 4.5:1.
