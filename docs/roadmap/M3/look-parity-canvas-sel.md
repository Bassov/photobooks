# look-parity-canvas-sel

Tag: feature
Milestone: M3
Title: look parity: canvas selection-only chrome

## Scope

Look parity, Phase A #2: canvas chrome only on the selection.

- [ ] Selected frame: 2px solid #232223 outline, offset 1px, plus white 1px ring; 8 resize handles (10px, white fill, 1.5px #232223 ring)
- [ ] Unselected frames/photos: no border, outline, white edge or drop-shadow; photos fill flush
- [ ] Spread/page paper: no black outline on canvas; selected spread = list #CACACA only; cover/endpaper/master nodes lose black sel-outline

**Done when:** canvas shows chrome only on the selected frame; no blue, no always-on borders/shadows.
**Browser check:** select a frame: outline + 8 handles; deselect: flush photos, no chrome.
**Perf:** no new per-frame work.
