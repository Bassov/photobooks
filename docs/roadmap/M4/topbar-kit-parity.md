# topbar-kit-parity

Tag: feature
Milestone: M4
Title: look parity: editor top bar and zoom menu as UI kit
Status: done

## Scope

Look parity (Owner 2026-10-29: the editor must look exactly like the UI kit; no fake / disabled controls). Top bar and zoom menu as in `uikit/src/sandbox/chrome.tsx`.

- [x] Remove the disabled Preview / Export / Publish placeholders; restyle Present as the kit Preview pill (Eye, `h-8 rounded-full px-3`) wired to `onPresent`
- [x] Zoom control: − / menu button ("Fit" or "N%", ChevronDown at .5) / +; `w-48` menu with Fit spread (Ctrl+0), Fit width, 100%, 150%, 200%, 400%, separator, 50%; `MenuKeyboard` key hints in `src/ui/Menu`; all through the existing camera store
- [x] Delete the CameraBar strip (render, component, `.camera-bar` / `.zoom-indicator` CSS) and move its tests
- [x] Top bar layout: `h-12`, `px-3 gap-2`, chrome bg, no border-bottom, no wrap; order Library, Title, History (ml-2), centred `mx-auto` tools and view toggles, Zoom, Panels, Preview
- [x] Undo / Redo tooltips "Undo (Ctrl+Z)" / "Redo (...)"

**Done when:** the top bar matches the kit order and look, zoom is driven from the menu, CameraBar is gone, no placeholder buttons remain.
**Browser check:** open the zoom menu, pick 200% (label "200%"), Fit spread (label "Fit"); Preview pill enters presentation.
**Perf:** no new per-frame work; zero LoAF.

- **Kit components:** top bar, `ZoomMenu`, `MenuKeyboard` (`uikit/src/sandbox/chrome.tsx` l.101-102, 123-137, 161-184).
- **Demo:** `uikit/src/sandbox/*` (editor sandbox top bar)
- **Musts:**
  - Placeholders removed; Preview pill on `onPresent`; − / zoom menu / + with all entries and key hints via the camera store; CameraBar gone; top bar layout and order as kit; tooltip format. Grayscale tokens only.
- **Hard nos:** no fake or disabled controls; no Export button; no new zoom math or camera logic; no `src/render/*`; no HELD items (masters, cover/endpaper, guides, photo-rotate, multi-select, Align); no new accent colours; keep the photo folder button.
- **Tokens:** `--chrome` (top bar bg), `--muted-foreground`; existing app tokens only.
- **Test:** unit — zoom label ("Fit" vs "N%"), each entry calls the camera store, key hints, tooltip strings, no disabled placeholders; e2e — pick 200% then Fit spread, Preview pill enters presentation, `camera-bar` absent.
- **Depends:** look-parity-page-labels
