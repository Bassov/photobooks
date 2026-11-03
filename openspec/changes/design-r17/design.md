## Decisions

1. M92 activation: `onGrayDown` (`canvas.tsx`) already runs `st.setCur(si)` (node → null: row `p{si}` + spread inspector), but the press bubbles to the shell's empty-canvas handler (`chrome.tsx`), which sets node `none` in the same batch. A handled grey press (select tool, not preview) calls `e.stopPropagation()`; the starter signature gains it, and `grayMarquee` already passes the React event. The marquee keeps its window listeners.
2. No re-centre (prod `pasteboardClickSpreadId` keeps the scroll): `canvas.tsx` exports `grayPick = { si: -1 }`, set by the grey press. The Stack centring effect (`viewport.tsx`) consumes it and skips centring when it names the new current spread (never for the last page). Same module-level idiom as `marqueeStarters`.
3. M93: `.spread-page-cut` (thumbnail mode only) background becomes the literal `rgb(0 0 0 / 0.1)` (kit `bg-black/10`). `docs/design.md` has no hairline token, and M91's `.endpaper-gutter` uses a literal the same way. `.spread-fold` untouched. No unit test asserts the old colour.

## Touch-set & Test Plan

| Path                             | Why                                           |
| -------------------------------- | --------------------------------------------- |
| `uikit/src/sandbox/canvas.tsx`   | grey press stops propagation, sets `grayPick` |
| `uikit/src/sandbox/viewport.tsx` | Stack centring skips a grey-press activation  |
| `uikit/scripts/qa.mjs`           | append r16 M92 block                          |
| `src/render/SpreadView.css`      | thumbnail cut colour                          |
| `e2e/design-r17-prod.spec.ts`    | M93 computed colours                          |

- Tests: kit qa: row `p0`, inspector "Spread · Page 1", page-1 label y unchanged ±0.5. e2e with a real book open: a list card cut is `rgba(0, 0, 0, 0.1)` and the canvas fold gradient is unchanged.
