# look-parity-filmstrip

Tag: feature
Milestone: M3
Title: look parity: filmstrip kit chrome
Status: done

## Scope

Look parity, Phase A #4: bottom dock and filmstrip in the kit look.

- [ ] Dock bar #E1E1E1 (data-testid=dock); plain head "Photos · {gallery} · {used} used" in #535152, no tab capsule/icon/shadow
- [ ] Thumbs: shadow-hairline, selected = #CACACA fill only (no black ring); used mark = corner check (black/55 + white check), no green/Placed pill
- [ ] Folder/filmstrip events as quiet inline status only (no toast)
- [ ] Sort/filter chips and empty/unplaced copy quiet ghost

**Done when:** filmstrip has no black selection ring, no blue, no green pills.
**Browser check:** import a folder, select and place a photo; dock reads grey, used check shows.
**Perf:** no new per-frame work; thumb virtualization unchanged.

## Done note

Filmstrip dock kit chrome, corner used check, quiet import-error status
