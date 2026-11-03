# parent-spreads-inspector-guides

Tag: feature
Milestone: P2
Title: parent spreads: master guides and rulers on the master canvas
Status: done

## Scope

- [x] Master guides on the master canvas (Designer Spec parent-spreads-inspector MS10): the master's `guides` render with the spread guide style (`.guide-line`, `--guide`, 1 px, ±24 px past the page); drag moves a guide (transform in rAF, commit at gesture end, one history step), drag onto its ruler removes it; with rulers on (Shift+R) the master stage shows the rulers and a drag from a ruler adds a guide to `parent.guides` (`addGuide` with the parent id)
- **Browser check:** Masters mode, Shift+R, drag a guide from the top ruler onto Master A — it lands in `parent.guides` and survives a reload.
- **Kit components:** `uikit#/feature/parent-spreads` (master guides); kit `viewport.tsx:224`
- **Demo:** `uikit#/demo` steps 74–75 (`editor-master-guides-edit`); regenerate their baselines
- **Hard nos:** no blue / teal; no layout shift or page-level H/V scroll
- **Perf:** guide drag on the master stays within the frame budget (rAF transform, one commit)
- **Test:** unit for the guide paths on a parent id; Playwright e2e on `?fixture=painter` (ruler-created guide in `parent.guides`, survives reload)
- Inherited guides on spreads and snapping stay in roadmap `parent-guides`.
- **Depends:** parent-spreads-inspector
