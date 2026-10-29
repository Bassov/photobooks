# look-parity-dock-filmstrip

Tag: feature
Milestone: M4
Title: look parity: dock header, folder drop overlay, filmstrip tiles and empty text
Status: done

## Scope

Look parity (Owner 2026-10-29: the editor must look exactly like the UI kit `uikit/` v0.9.3; no fake / disabled controls). This is a **visual-only look-parity subset** of the existing filmstrip items ([`filmstrip-resize-drop`](../M3/filmstrip-resize-drop.md), [`filmstrip-sort-filter`](../M3/filmstrip-sort-filter.md), [`look-parity-filmstrip`](../M3/look-parity-filmstrip.md)): they own the behaviour and their boxes stay as they are; no new drop / import logic here.

- [x] Dock header (kit `Dock`): `Photos · {gallery} · {used} used` label; sort and Unplaced chips restyled to the kit chip text ("Added order" etc. without the `Sort:` prefix, "Unplaced")
- [x] Folder drop overlay while an external folder / file drag is over the dock: "Drop a folder to add its photos" (driven by the existing external-drag handlers)
- [x] Filmstrip tiles: `object-cover` thumb, kit name strip from thumb height 90, kit remove (×) look on hover; placed badge already matches the kit
- [x] Empty texts: "Every photo is placed. Turn off “Unplaced” to see all." / "No photos yet — add a folder or drop one here."
- [x] N/A: low-res chip and missing-file tile — the app has no per-asset low-res or missing data for the gallery, so nothing is shown; no Templates tab, no folder button

**Done when:** the dock header, chips, tiles, name strip, drop overlay and both empty texts read like the kit; no accent colour.
**Browser check:** import a folder, place a photo (check badge appears), drag a folder over the dock (dashed overlay); empty book shows the empty text.
**Perf:** CSS / static elements; one boolean context for the name strip changes only at the 90 px threshold; virtualisation, scroll commit and resize untouched.

- **Kit components:** `Dock`, `Filmstrip` / `ThumbItem` render and empty state (`uikit/src/sandbox/chrome.tsx` l.440-500).
- **Demo:** `uikit/src/sandbox/*` (chrome)
- **Musts:**
  - Dock header row + label + chip restyle; folder drop overlay; tiles + placed badge + name strip; both empty texts.
  - Grayscale tokens only.
- **Hard nos:** no fake or disabled controls, no Templates tab, no folder button; no new drop / import logic; no changes to virtualisation, scroll commit or resize; no spreads panel, pasteboard, status line, inspector, rulers or top bar changes; no new accent colours.
- **Tokens:** `editorChromeTokens.ts` (`SUB`, `BAR`, `FIELD`, `SEL`), `--muted-foreground`, `--chrome`, `--select`, `--text-2xs`; overlay outline uses the existing mark grey `#8E8E8E`.
- **Test:** unit — header text, both empty texts, placed badge only on placed assets, name strip only at thumb >= 90, overlay only during an external drag; e2e — placed badges after placing (drag-place), empty book shows the empty text (filmstrip).
- **Depends:** look-parity-page-labels, filmstrip-resize-drop, filmstrip-sort-filter, look-parity-filmstrip

## Done note

visual-only subset; low-res / missing omitted (no data)
