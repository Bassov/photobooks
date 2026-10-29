# Photobooks UI kit (v0.10.0)

A UI/UX reference for Photobooks, **organised by app screen**. Each screen
(Home, Import, Editor, Settings, Unsupported browser, …) has its own page with a
full live demo of that screen and the list of roadmap features that live on it.
Every roadmap item that has a user-facing UI still gets its own feature page,
with a live, clickable demo (mock data, no backend) and a short set of UX notes
covering what it is, where it lives, why it exists, the keys, and the edge cases.

**`docs/roadmap.md` is the source of truth.** The kit doesn't track status,
checkboxes, descriptions or links. It mirrors only the roadmap slugs (in
roadmap order) for items that have UI, and adds one thing of its own: which
app screen each item lives on. When the roadmap
and the kit disagree, the roadmap wins and the kit gets updated.

Stack: Vite 8, React 19, TypeScript, Tailwind 4 and react-aria-components (a
JollyUI port, in a single Procreate-light theme). The kit is a standalone package and shares
nothing with the app build.

## v0.10.0 — kit decomposed into #/demo parts

Every feature page now mounts only `src/demo-parts` at real editor slot sizes, grouped by roadmap item with a scenario switcher; old kit-only feature components and the `#/parts` scratch route are removed; qa checks for the old kit-only editor are deleted. `#/demo` is pixel-identical to v0.9.3. Old→new page slugs: see the Stage 4 slug map.

## v0.9.3 — site library home, outlined tool cursors, Space≠panels, outline cleanup

- **Personal site library home:** Open site / share lands on a catalog grid of **published** books (same book-object language as the app library). Opening a book goes to the viewer + fullscreen; book deep links (`siteEntry=book`) still open that book.
- **Tool cursors:** Frame crosshair and Text I-beam are white with a thin black outline (`cursor: url(svg…)`), visible on paper and photos. Select stays arrow; Pan stays grab. Viewport + Stack + spread surface.
- **Space = pan only:** While Space is held, panel hotkeys (`[`, `\`, `]`, `i`, Tab-hide, Cmd/Ctrl+.) are ignored. Capture-phase Space `preventDefault` so Space never toggles panels. Keeps v0.9.2 `data-panning` outline suppress.
- **Outline audit:** Filmstrip + template strip selection is tone-only (`#CACACA`, no black `ring-select`). Removed dead amber `--crop: #e0a33a` from `index.css`. AppModal `border-0`. **Keep:** canvas frame sel-outline `#232223` + handles; spread list `#CACACA` no outline; guide dashes with `data-allow-border`; grayscale crop; quiet header buttons; tone-only cards; gray keyboard focus rings (a11y; not black; not on canvas while panning). Space-pan outline suppress from v0.9.2 unchanged.

## v0.9.2 — Space pan: no canvas focus ring

- **P1:** Holding Space (or Hand tool) to pan no longer draws a dark `:focus-visible` outline around the canvas viewport. `data-panning` suppresses the ring; Tab focus ring remains when not panning. Space `preventDefault` outside text fields so the page never scrolls.

## v0.9.1 — consistency / duplication pass

- **One Create book dialog** (title + Page size) shared by `#/demo` and the full library — no title-only variant.
- **Preview** opens an in-app preview of the *current* book (not the published Site). Wired on `#/full/editor` and `#/demo`.
- **One page-count model:** editor, print, and site pager use `pagesOf(spreads)` (e.g. Cover · 1 / 20).
- **Inline Rename** in the demo library (same as full library); rename dialog removed.
- **Binding / Material / Fill** demoted to read-only / coming-later (no fake selected controls).
- **One Crop entry:** inspector only; floating frame Crop toolbar removed.
- **Quiet header buttons** share `#D7D7D7`; Publish stays non-primary.
- **Settings:** no card borders; live book count; same grayscale chrome.
- Demo library Search + Sort; “…” aligned to cover; quiet Published chip; folder picker without “emulated”; parent-spreads tip grayscale; Change library same copy/confirm.
- **P2 (post-approval):** unified empty-slot copy (list + inspector `N empty`; frame `Empty — drag a photo`); “…” flush to cover right edge.

## v0.9.0 — designer review of v0.8.1

- **Photo credit captions** match the approved placement: Welcome top-right plain text (no capsule); empty library under the example book beside EXAMPLE. 11px #535152, links same grey.
- **Empty library** hides the "0 books" count; the count appears only when ≥ 1.
- **No filmstrip / photo-folder floating toasts.** Folder import, "no new photos", and "folders not single photos" use the quiet status line only.
- **Replace removed.** No Replace button or photo-picker modal on frames or the cover. Place and replace only by dragging from the filmstrip (cover accepts drops too).
- **Grid Row gap** shows its number and "mm" (short field labels so the value is never squeezed out).
- **Floating page switcher removed** from the canvas; left spread list and keyboard remain.
- **Tool cursors** on the canvas: Frame = crosshair, Text = I-beam, Pan = grab, Select = arrow.
- **Mouse wheel zooms** to the pointer over the canvas (no wheel-pan). Pan stays Space+drag / middle-button / hand tool.
- **Publish** in the editor header is quiet gray chrome like Preview / Print / Export — not primary black.

- **P2 (post-approval):** floating page switcher also removed from `#/feature/parent-spreads` (`ParentStd` no longer mounts `Pager`).

**QA:** v0.9 acceptance block covers each item. Replace checks rewritten as filmstrip-drag checks. Caption placement asserts top-right / under EXAMPLE with no capsule.

## v0.8.1 — designer review of v0.8.0

**P1**
- **Per-book editor state.** In #/demo each book keeps its full editor state for the session: spreads, size, cover photo, cover text (front, spine, back) and masters, including the grid. Reopening a book restores it (Std `keep`, `getEditorExtras` / `setEditorExtras`). Library cards show the current cover.
- **The published site shows the user's own book.** It uses the book's title, page count and slug (`aleksandr.photos/<title>`). Page 1 is the real cover spread (photo and cover text), also in Fullscreen. `SiteViewer` resolves the book from its `books` prop first.
- **Demo filmstrip.** One plain label, "Photos · N · M used", with no Photos/Templates capsule. Templates stay in the spread inspector's Layout section.
- **Library path fixed.** It no longer shows "~/Pictures/~/Pictures/…".

**P2**
- The demo library cards have a "…" menu: Open, Rename (dialog), Duplicate, Remove (confirm).
- Pressing Esc in site Fullscreen returns focus to the Fullscreen button.
- Double-clicking a slider resets it to its real default: frame-style Mat, Stroke and Corner radius (the preset's values); spread Margin and Gap (0); Compare (50); the imposition and spine Pages sliders (14 and 40).
- Grid guides (columns, rows, content box) carry `data-allow-border`.
- The print dialog uses the real page count (2 × spreads) and shows the book's own size, e.g. "Custom · 19 × 23 cm". The file name includes the size.
- Create book offers "Custom size…" with width and height fields (10–42 cm).
- A new book starts blank: no cover photo, and the cover text is the book's own title instead of "Summer by the sea · 2025". The cover inspector's front, spine and back fields are now editable.
- The demo library bar has one Settings button: the gear, which now opens Settings.
- Grid snapping works visibly. With the grid shown, dragging a frame pulls its edges to column and row edges (16 px), draws the snap line and reports "Snapped to column N · row M".

**QA:** a new v8.1 block with one check per item. The demo walk creates a custom-size book, edits the cover photo, cover title and master grid, leaves and reopens the book (state kept), checks print, publishes, and checks the site (title, cover, pages, slug, fullscreen focus). It then exercises Rename, Duplicate and Remove and the Settings gear.

## v0.8.0: v8 requirements (research/v8/v8-requirements.md)

- **Credits.**
  - The CC BY-SA caption now appears in the product's Welcome screen and empty library.
  - It sits in the bottom corner: 11px, #535152, contrast 4.79:1.
  - Its links use the same grey as the caption, so they are not accented.
- **Library "..." menu.**
  - The button sits in the same place on every card.
  - An outside click or Esc closes the menu; Esc returns focus to the button.
- **Editor.**
  - The filmstrip has a single label, "Photos · N · M used".
  - Page-size presets come with hint text.
  - Sliders:
    - double-click resets to the default;
    - arrow keys move one step, Shift moves ten;
    - the value field can be edited.
  - A grid editor works per master and per spread: Use master / Custom, columns, rows, gutters and margins. The guides render on the canvas and snapping follows them.
- **Site screen.**
  - Redesigned in the library style: title, author line, page navigation, Share and Fullscreen.
  - Fullscreen fits the book with 32px padding, and Esc, the arrow keys and swipe all work.
  - The Paper / Night / Sage switcher and the zoom were removed.
- **#/demo.**
  - A clickable end-to-end prototype, linked from the index with a primary card.
  - The flow: welcome → choose folder → library → new book (size presets) → editor (add folder, edit) → publish → site → print → back to the library → settings.
  - None of its buttons are dead.
- **QA.**
  - QA adds 7 checks, one per item.
  - Full QA is green and the typecheck and build are clean. No screenshots.

## v0.7.4 — final polish (uikit-audit/v7.3-review.md, approved 9.0/10)

- **P2-1** The low-DPI badge and the filmstrip "Low-res" chip now use the field grey (#D7D7D7) with dark ink, not near-black.
- **P2-2** The Masters inspector now works. The page-numbers switch, the position control (Outer / Centre / Inner), the top margin and the grid columns and gutter all change the master's render on the canvas and in its thumbnail. Each demo starts from the default masters.
- **P2-3** Dashed guides now carry `data-allow-border`: inherited master items, the master margin box and the cover safe area.
- **P2-4** Replacing the cover photo now counts as using a photo. The new photo gets its ✓ in the filmstrip, and the old one loses it unless it is also on a page. The "N used" count always matches the ✓ marks. Root cause: the filmstrip grid cached its rows and never redrew the marks.
- QA adds a check for each fix. Full QA is green. No screenshots.

## v0.7.3 — designer review of v0.7.2 (uikit-audit/v7.2-review.md)

- **P1 Master A/B/None now renders on the canvas** (ported from v0.5.3). Built-in Master A adds folio frames and 12 mm margin guides. Master B adds a running head, a caption band and column guides. None shows nothing, and the spread has no outline. Spreads default to A. Master items draw above photos and ignore clicks (testid `master-frame`). QA switches A/B/None and checks the rendered frames and guides.
- **P2 spread-list-panel**: removed the pasteboard scroll with the hidden scrollbar. QA checks it.
- **P2 Tab walk**: QA adds a forward walk of 60 plain Tabs with the panels hidden: 0 leaks. Caveat: a plain Tab on the canvas still re-shows all panels (the Figma-style shortcut). Only the Tabs pressed while panels are hidden are counted.
- **P2 Replace**: when the picker closes, focus goes back to the opener, or to the canvas if the opener is gone. Ctrl+. is no longer swallowed by file, checkbox or button inputs. QA checks that Ctrl+. hides the panels after a pick.
- **P2 Crop after multi-select**: the selection-handles overlay was catching clicks and deselecting the frame. It now ignores clicks except on the handles themselves. A plain click on one frame of a multi-selection now selects just that frame. Crop also selects its frame explicitly. QA runs 8 loops, 8/8 pass.
- **Site themes**: the Night and Sage themes only colour the site preview (`data-testid="site-preview"`). QA checks that the editor chrome stays hue-free under each theme.
- QA: 217/217 PASS, 0 console errors. No screenshots, per the brief.

## v0.7.2 — designer fixes for v0.7.1 (6.5/10)

QA: **210/210 PASS, 0 console errors/warnings** (21 new v7.2 checks). tsc and build are clean.

- **P0-1** Hidden panels (left, dock, inspector) get `inert`, `aria-hidden="true"` and `data-hidden-panel` on #/full/*, #/screen/* and feature pages. The kit's modal-inert MutationObserver leaves them alone. The zero-width-only approach is gone. QA checks Ctrl+. on all three routes: the attributes are set, they survive 600 ms, Shift+Tab never lands inside a hidden panel, and a second press restores the panels.
- **P0-2** Replace in the frame toolbar and on the cover opens a picker (From file… plus library photos) and swaps the photo. From file… uses a blob URL. QA checks both.
- **P1-3** Every demo book has at least 20 pages (MIN_SPREADS=10). Library meta reads "N pages". QA checks this.
- **P1-4** Editor and demos are grayscale: status, guide, badge and theme tokens are neutral, and so are the site palettes, swatches and mac dots. QA scans for hue and checks text contrast ≥ 4.5:1.
- **P1-5** Photo inspector: Fill/Fit, Zoom, Rotate & flip (H/V), Adjust (brightness/contrast/saturation + Reset), Caption. Spread inspector: Master (A/B/None) and Margin 0–30 mm / Gap 0–20 mm, which re-flow the template frames.
- **P2-6** `npm run shots` also shoots every editor scenario, the replace picker, crop mode, full-editor and full-home, and writes editor-scenarios.md5.
- **P2-7** When there is no room above the frame, the frame toolbar drops inside the top of the frame, so it no longer covers the page number.
- **P2-8** The DPI badge (.pb-badge) has no inset ring.
- **P2-9** The bleed, safe, snap, Preview, Release-to-replace and crop chips are light grey (bg-field). Black is used only for the canvas selection, the primary button and used-photo badges.
- **P2-10** Inline favicon, so #/full/* has no 404 over HTTP.
- **P2-11** The bleed and safe guides carry data-allow-border.

Deviations, stated openly:
- The Master choice is stored per spread but not yet drawn on the canvas.
- The optional "sage" site theme keeps its colour. The default light and dark themes are neutral.
- The contrast check skips text sitting on photos and disabled controls.
- Three older QA checks were adjusted, not loosened:
  - book meta now accepts "pages";
  - the slider-drag test hovers the thumb first, because the Zoom slider now sits at the fold;
  - the panel Tab-leak probe uses Shift+Tab, because a plain Tab on the canvas is the existing toggle-all-panels shortcut.
- Grayscale overrides were merged into the single procreate-light token block.
- Shots were not regenerated for this release (the designer takes their own). The shots script is updated.

## v0.7.1 — designer fixes for v0.7.0 (7/10)

QA: **189/189 PASS, 0 console errors/warnings**. tsc and build are clean. Being honest about the v0.7.0 changelog: it claimed a full pass, but QA never compared the scenario shots, so the identical editor shots got through. v0.7.1 hashes the shots.

- **P0 #1, scenario shots:** each editor scenario now mounts its own state: Photo, Cover, Endpaper, Masters, Book settings, Landscape and Nothing selected. QA checks that each scenario's DOM signature is unique and that each screenshot's md5 is unique. The hashes are in `uikit-v7.1/editor-scenarios.md5`.
- **P1 #2, keyboard trap:** Cmd/Ctrl+. is still the main way to hide all panels. Tab hides panels only from the bare canvas and only with no modifiers. A second Tab moves focus on, and focus never returns to the canvas. QA covers Shift+Tab, Ctrl+Tab, Tab from inner focus, the second Tab and Ctrl+.
- **P1 #3, ONE editor:** the old editor (`editor7.tsx`) is deleted. The v0.5.3 features now live in the single editor:
  - templates: All/My, search, save, rename, duplicate, delete and hover preview
  - filmstrip drag
  - all inspector parameters
  - multi-select
  - the Replace/Crop toolbar

  The feature pages are restyled to v7, and the list uses page labels (1, 2–3 … 20). QA scans every screen and feature page for the old markers ("Spreads 8", "1 Cover", "Spread 1 · cover" and the dark spread outline).
- **P1 #4, page count:** the header and Book settings now agree (20 pages, limits 20–120). QA covers this.
- **P2 #5, Home demo:** the second row of books is no longer clipped (QA).
- **P2 #6, Book settings shot:** it is now taken in Pages mode (QA).
- **P2 #7, borders are tone only:**
  - The global `*` border colour is now transparent.
  - The Create book dialog has no border-t, and its Cancel button is ghost.
  - The outline button is now a field tone.
  - The published-site header and round buttons have no border.

  QA checks that rendered borders are 0 on every kit page. The only exceptions are print/grid guide overlays, the device bezel and the print guide, all marked `data-allow-border`.
- **#8:** no change needed.
- **Also fixed:**
  - init doc geometry was scaled twice
  - RAC drag-handle warning
  - the inspector open state leaked between demos

## v0.7.0 — Editor redesign + neutral kit chrome
- New editor (Editor7): 3 borderless neutral-grey surfaces, no blue; quiet grey Export with icon; list selection #CACACA (hover #D7D7D7), bold, no outline; canvas selection = 2px #232223 outline + handles only.
- Panel toggles + keys `[` spreads, `\` photos, `]` inspector; Cmd/Ctrl+. hides all; Tab hides all only when canvas is focused.
- Page numbers live in the canvas layer (move with pan/zoom); filmstrip header "Photos · N · M used".
- List order Cover / front Endpaper / page 1 / spreads / last page / back Endpaper (endpapers only when enabled); Pages/Masters toggle (margins, columns, #).
- Inspector follows selection (empty: "Select a spread or photo"); Book settings from title: orientation, presets 19×24, 21×28, 24×19, 28×21, 20×20, 30×30, custom W/H → Custom; size change re-proportions layout.
- Thin scrollbars 4/6/8px (#A8A8A8/#969696/#7E7E7E), none on canvas.
- Sliders variant B everywhere: 3px #CACACA track, fill #A8A8A8 (#8E8E8E dragging), 14px #F7F7F7 knob, soft shadow, 4px halo while dragging.
- Toggles ON #A8A8A8 (hover #8E8E8E) / OFF #CACACA, knob #F7F7F7; selected swatch 2px #8E8E8E ring, 2px offset.
- Black #232223 only for canvas selection, primary button, used-photo badges.
- Kit chrome: surfaces #C8CACB/#E1E1E1, controls #D7D7D7, white only for paper, no borders/lines (incl. inputs, select, search, kbd), nav selected #CACACA / hover #D7D7D7, links #393738 underline on hover, Inter/Lora.
- QA: 177 checks, all PASS. Screenshots with real scrollbars (no --hide-scrollbars).

## Reference convention

Roadmap items, PRs and issues link to a kit page with:

```
UI ref: uikit#/feature/<slug>
```

For example, `UI ref: uikit#/feature/missing-assets-relink`. When the kit is
built, that is `uikit/dist/index.html#/feature/<slug>` (it opens over
`file://`); in dev it is `http://127.0.0.1:5173/#/feature/<slug>`. The legacy
`#/f/<slug>` form still resolves. Every v3 slug and URL still works.

A whole screen is referenced with `UI ref: uikit#/screen/<id>`, for example
`uikit#/screen/unsupported-browser`.

## Run

```bash
npm i
npm run dev          # http://127.0.0.1:5173
npm run build        # → dist/ (single classic bundle, base "./", hash routing; open dist/index.html directly)
npm run typecheck    # tsc -b
npm run qa           # headless checks on dist/ (build first); writes qa-report.txt, exits non-zero on failure
npm run qa:quick     # same, without the per-page layout probe at two viewports
npm run shots -- shots all b 1440x900 full   # screenshots: <outdir> [slugs|all] [b|b-dark] [WxH] [full]
```

`qa` and `shots` drive a locally installed Chrome or Chromium through
`playwright-core`. No browser gets downloaded. The scripts look in common
install locations; to point them at a specific binary, set
`CHROME_PATH=/path/to/chrome`.

What `qa` checks:
- The page manifest and the demo registry agree: no missing or orphaned demos.
- Every feature sits on exactly one known screen, and every screen has a demo.
- Index links (features and screens) are valid, the index groups match the
  manifest `screen` field, the legacy alias and old `#/feature/<slug>` URLs
  work, and unknown slugs / screens get a not-found page.
- For every feature page and every screen page, in the single Procreate light theme, at 1440×900 and at 1280×800:
  - the demo is visible and non-empty;
  - nothing is clipped by the demo frame;
  - there is no horizontal overflow and there are no broken images;
  - there are no console errors or page errors.
- The index works: search (slugs, titles, screen titles), the `/` and `Esc` keys, the kind filter, the milestone filter, collapsing screen groups, and restoring state after browser Back.
- Each screen page lists exactly its features; every feature page links back to its screen; the screen prev/next walk and Alt+← work.
- The prev/next walk, the Alt+←/→ shortcuts and the notes toggle work; there is exactly one theme (Procreate light) and no stylesheet uses `scrollbar-color`.
- Interaction smoke tests pass on the key demos (relink, drag-place, inspector, panels, export, and so on), plus the v4 changes: single library + Change library folder, library folder missing, first run, folder-only import (a loose-file drop imports nothing), and the unsupported-browser screen (links, three scenarios); v5: spread list without horizontal scroll, contextual inspector (Spread/Photo/…, `I` toggles it, floating toolbar = Replace + Crop), templates Save as template → Rename → Duplicate in My templates, Home covers on a common baseline with the New book tile first.

## Using the kit

- **Index** (`#/`): one group per app screen, in app order; inside a group the
  features appear in roadmap order with their milestone. The screen heading (or
  “Screen demo”) opens the screen page; a row opens the feature page. Search
  matches a slug, a title or a screen title. Press `/` to focus search and
  `Esc` to clear it. Filter by All, Interactive or Static, and (secondary) by
  milestone; each screen group collapses. Opening a page and coming back (via
  the Index link or browser Back) restores the search, the filters, the
  collapsed groups and the scroll position. This state lives in `sessionStorage`.
- **Screen page** (`#/screen/<id>`): UX notes for the screen, a full live demo of
  the screen, the cards of every feature on it, and previous / next screen
  links. Alt+←/→ moves between screens.
- **Feature page** (`#/feature/<slug>`): a breadcrumb and an “On screen: …” link
  back to its screen, a collapsible UX notes block (its open/closed state is
  remembered), a full-width demo, and prev/next links. Prev/next and Alt+←/→
  follow the kit order: screen by screen, roadmap order inside a screen.
- **Components** (`#/components`): the primitive and component gallery.
- There is one theme (Procreate light); no theme toggle.

## Structure

- `src/kit/pages.json` is the page manifest: `{slug, title, group, kind, screen}`
  in roadmap order. `group` is the milestone, `kind` is `interactive` or
  `static`, `screen` is the id of the app screen the feature lives on. This is
  the only list of feature pages.
- `src/kit/screens.json` is the screen manifest: `{id, title, summary}` in app
  order. `src/features/screen-demos.tsx` (`SCREEN_DEFS`) gives each screen its
  notes and either its own demo (`Demo`) or the feature demo it reuses (`from`).
- `src/kit/` also holds the kit shell (index, screen page, feature page, nav, search), the
  Components page, the hash router and the theme.
- `src/features/` has one file per milestone. `registry.tsx` merges them into
  `FEATURES`, which maps each slug to its `Demo`, its `notes` and an optional
  height or `auto`.
- `src/sandbox/` contains the mock editor: the document model (in mm), the
  canvas, the viewport, the editor chrome, the inspector and history.
- `src/components/`:
  - `ui/` is the JollyUI port (MIT; the toast is Apache-2.0).
  - `uui/` is Untitled UI Badge and FeaturedIcon (MIT).
  - `app/` holds the app-density wrappers.
- `scripts/file-protocol.ts` is a Vite plugin that emits a classic
  `<script defer>`, so `dist/index.html` works over `file://`.
- `public/photos/` holds the CC0 demo photos (see `PHOTO-CREDITS.md`).

## Adding or changing a page

1. Add the item to `docs/roadmap.md` first.
2. Add `{slug, title, group, kind, screen}` to `src/kit/pages.json` at the same
   position it has in the roadmap. Use the exact roadmap slug and an existing
   screen id (or add the screen to `screens.json` and `SCREEN_DEFS` first).
3. Add a `FEATURES[slug]` entry in the milestone file under `src/features/`,
   with a `Demo` and `notes: {what, where, why, keys?, edge?}`.
4. Run `npm run typecheck && npm run build && npm run qa`.

If the roadmap removes or renames an item, remove or rename the kit page too.

## Product decisions reflected in v4

1. **Structure by screens.** See “Using the kit” above. 14 screens: first-run,
   home, import, editor, editor-chrome, free-layout, text-styles, presentation,
   print-prep, print-export, showcase-site, publish, settings,
   unsupported-browser.
2. **One library only.** The user sets exactly one folder as the library. There
   is no recent-libraries list, no second library and no switching. To use
   another library, change the library folder (the inline “Change library folder…” under
   the Home title, or Settings → Library); a confirm explains that the books stay
   in the old folder, nothing is moved or deleted, and a banner offers “Switch
   back”. A missing library folder shows “Can’t find your library folder” with
   Try again / Change library folder….
3. **Import only a folder.** Photos come in only as folders: “Add folder…” or a
   folder dropped on the editor / filmstrip (subfolders included). There is no
   file picker. Loose files dropped import nothing; a toast says “Photobooks
   adds folders, not single photos — drop the folder that holds them”. A folder
   dropped together with loose files is added and the loose files are ignored
   (the toast says so).
4. **Unsupported browser.** Without the File System Access API the app shows
   “This browser isn’t supported” (Chrome recommended, links to Edge, Brave,
   Arc, Opera, Vivaldi, Copy link), with variants for Chromium with the API off
   and for phones / tablets. Detection is by feature, not user agent. See
   `#/screen/unsupported-browser`.

## v4.3 third-review fixes (0.4.3)

| ID | Issue | Fix |
|---|---|---|
| G-01 | The accessible name of a disabled button with a reason included the reason ("Export Add a photo folder first — the book is empty"); the cause was `button.tsx`, where the reason span was nested inside the button | The reason span is now a sibling of the button and is linked through `aria-describedby`. The name is now "Export" and the description is the reason. |
| G-02 | The "Select (V)" tooltip stayed in the DOM (data-exiting, role=tooltip) after fast Tab or Escape | Tool and view tooltips use a controlled `ToolTip` that opens only while the control is focused or hovered. Escape closes it, and the tooltip is unmounted when closed. `tooltip.tsx` keeps only the enter animation. |
| G-03 | Preflight showed "Fix 2 errors to export" in the panel, but Export in the top bar looked available | The Preflight screens pass `printErrors` to the top bar. Export opens a menu where "Print PDF…" is disabled with an error badge and the same reason as the panel ("Fix N errors to export · see Preflight"). JPEG spreads and Static site stay available, because errors block only print. |
| G-04 | Reduced motion did not override the `--duration-*` tokens on themed roots | `:root, html[data-theme], [data-theme]` set every `--duration-*` to 0ms inside `prefers-reduced-motion`. |
| G-05 | Home showed 6 books at 5 columns, which left a gap in the second row | Home now shows 10 books (City weekend, Lake house, Spring garden and Winter in the hills were added), so both rows are full. |

The F-08 and F-12 caveats from v4.2 were the same issues as G-01 and G-04, so both are now closed.

QA adds a "v4.3 re-audit" block, which checks:
- the accessible name equals the visible label and the description equals the reason;
- at most one tooltip is shown while tabbing, and none after Escape or blur;
- Preflight and Export → Print PDF give the same reason;
- reduced motion sets the duration tokens to 0;
- the Home rows are full.

Result: **99 passed, 0 failed**, 0 console errors. The probe found 26 hits, all exempt (16 contrast, 9 tiny text, 1 size), with no regression. Before/after shots are in `research/uikit-audit-fixes-v3/`.

## v4.2 re-audit fixes

v0.4.2 fixes the second review of 0.4.1 (`research/uikit-audit/v2-fix-list.md`, F-01..F-12):

- **Home:** the grid is `repeat(auto-fill, minmax(240px, 1fr))`, capped at 1600 px. That gives 5 columns at 1440 (qa checks for at least 4). The cover title is 14 px.
- **Type:** the 15 px `md` step is removed. The scale is now 11 · 12 · 13 · 14 · 18 · 21 · 26 · 32. Compact density shifts sm and xs to 12.5 and 11.5, so no two steps share a value.
- **Inspector:** with nothing selected the tab reads **Spread**, and one `text-xs` line ("Select a frame to edit it.") replaces the old hint block.
- **Disabled primaries explain themselves:** `<Button isDisabled disabledReason="…">` stays focusable (`aria-disabled`), ignores presses, shows the reason in a tooltip on hover or focus, and exposes it through `aria-describedby`. The reasons are:
  - "Fix 2 errors to export" (Export print PDF, which also has a visible hint);
  - "Fill in the account and the token to test" (Test & save, which also has a visible hint);
  - "Add a photo folder first — the book is empty" (top-bar Export);
  - "Relink or locate at least one photo first" (Resolve).
- **Tokens:**
  - badge success and warning text now reuse `success-fg` and `warning-fg`;
  - dark `--input` is #77746e;
  - role shadows alias the base scale (card = sm, card-hover = md, float = md, stage = lg);
  - `rounded-2xl` is removed, and xl is used for dialogs, popover cards and empty-state cards;
  - new `--duration-exit` 150 ms and `--ease-in`, plus a `prefers-reduced-motion` override.
- **Spacing rule:** half-steps (0.5, 1.5) appear only inside primitives (badge, kbd, chip, icon-to-label gap). Panels, list rows and sections use whole steps.
- **qa lint:** now also fails on arbitrary `p-/m-/gap-[…]` values (percentages allowed) and on `duration-N`. There are 3 new smoke checks, for 92 checks in total.
- **Design-tokens page:** the swatches show their contrast against background, and include the new roles plus control-height roles (28 toolbar · 32 panel · 36 dialog · 40 empty state).

## v4.1 audit fixes

v0.4.1 fixes the design audit of v0.4.0 (`research/uikit-audit/uikit-audit.html`, 214 findings:
6 high, 114 medium, 94 low). The full ledger is in `research/uikit-v4-changes.md` → “v4.1 audit fixes”.

**Token scales (src/index.css, `@theme`)**

| Scale | Tokens |
|---|---|
| Type (px / line-height) | `2xs` 11/16 · `xs` 12/16 · `sm` 13/18 · `base` 14/20 · `lg` 18/24 · `xl` 21/28 · `2xl` 26/32 · `3xl` 32/38 |
| Control height | `--control-xs` 28 · `--control-sm` 32 · `--control-md` 36 · `--control-lg` 40 (Button sizes `xs/sm/md/lg`, `icon-xs/icon-sm/icon`) |
| Spacing | 4 px base: 1 · 2 · 3 · 4 · 6 · 8 · 12 (4–48 px). Half-steps (0.5, 1.5) only for icon gaps, badges and dense rows; 2.5 / 3.5 are gone |
| Radius | `2xs` 2 · `xs` 4 · `sm` 6 · `md` 8 · `lg` 10 · `xl` · `2xl` (+ `device` 34 for the phone mock) |
| Shadow | `xs/sm/md/lg` + named `hairline`, `thumb`, `card`, `card-hover`, `float`, `stage`, `pill`, `page`, … |
| Motion | `--duration-fast` 120 ms · `--duration-base` 200 ms · `--ease-out`; no `transition-all` |

**Key colours and contrast** (light / dark; text needs 4.5:1, borders and focus 3:1)

| Token | Light | Dark |
|---|---|---|
| `muted-foreground` | #625f5a — 6.09 bg · 6.36 card · 5.23 canvas · 5.20 accent | #a8a49d — 6.87 bg · 6.26 card · 5.24 accent |
| `destructive` (text) | #a8403a — 5.82 bg · 4.97 accent | #e8857a — 6.55 bg · 5.00 accent |
| `success-fg` (status text) | #2c7346 — 5.52 bg · 4.71 accent | #6cbf89 — 7.67 bg |
| `warning-fg` (status text) | #8a5a12 — 5.67 bg · 4.84 accent | #e0b25a — 8.67 bg |
| `ring` (focus) | #7d7871 — 4.20 bg · 3.58 accent | #8f8b84 — 5.03 bg · 3.84 accent |
| `input` (field border) | #8a857d — 3.51 bg · 3.66 card | #77746e — 3.66 bg · 3.33 card (v4.2) |
| `control` (outline-button border) | #d6d2cb (decorative; the label carries the meaning) | #3d3d3d |
| `bleed` / `guide-solid` (print labels) | white text 5.83 / 5.54 | same |

`--success` / `--warning` stay for icons and fills; text uses the `*-fg` tokens. On-paper content
(book ink, placeholders, parent-spread accents, DPI badges) uses its own theme-invariant tokens
(`ink`, `placeholder*`, `parent*`, `dpi-*`), because paper is light in both themes.

**Rules enforced by qa:** `scripts/qa.mjs` fails on `text-[Npx]`, `shadow-[…]`, `rounded-[Npx]`
and `transition-all` anywhere in `src/` (4 lint checks; 87 checks in total).

**Conventions:** one primary per view; the editor top bar is always status · Fit · Preview ·
[Publish] · Export, and Export turns outline when the book is empty, Publish is the view's action, or
an overlay owns the primary. Shortcuts are written `Ctrl+Shift+Z` (chords with “+”, alternatives
with a space or “ / ”), and Ctrl renders as ⌘ on macOS. Verbs: non-modal panels **Done**, settings
**Save**, viewing **Close**. Panel headers use Inter 13/600; Lora is for book titles and screen headings
(26 / 32).

## Embedding as `uikit/`

The kit lives in its own folder with its own `package.json` and lockfile, and it
contains no absolute paths. Leave it out of the app's build, lint, test and
coverage globs, and treat it as a separate package.

## Possible next steps (CI)

- Add a CI job that runs `npm ci && npm run typecheck && npm run build` in
  `uikit/`, and optionally `npm run qa:quick` against a preinstalled Chrome.
- Optionally, publish `uikit/dist` as a build artifact so reviewers can open the
  `UI ref:` links.

## What's new in v6.1 (0.6.1): three surface levels and library search

- **Surfaces (whole kit), following welcome7:**
  - **Canvas and app surround:** #C8CACB with white 16 px dots (`radial-gradient(circle, rgb(255 255 255/.55) 1px, transparent 1.4px)`).
  - **Chrome:** one tone, #E1E1E1, for the kit header (now opaque), app top bars, side panels, inspector, bottom bar, cards and menus.
  - **Controls and inputs:** #D7D7D7. This covers text, number, search and select fields, outline buttons, tab lists, segmented controls and slider tracks. The selected pill uses the chrome tone.
  - **White:** paper only, meaning book pages, spreads, thumbnails and paper swatches.
- **Pure neutral greys:** #D8DBE1 is gone, along with every other faintly tinted near-grey. All surface tokens are now R=G=B: secondary, subtle, muted, accent, border, control, input, cover-empty, placeholder, card-edge and scroll thumbs. The only exemption is the canvas #C8CACB, which was user-specified.
- **Contrast:** every text token is at least 4.79:1 on #C8CACB, #E1E1E1, #D7D7D7 and #FFF.
- **Library:**
  - Search and sort are back, in the top bar. Both are quiet #D7D7D7 pills on #E1E1E1 chrome, with tone only: no border, no shadow, no black.
  - **Search books** filters by title; Esc clears it, and a "No books match" message offers Clear search.
  - **Sort** offers Last edited (the default), Title and Created.
  - **Unchanged:** Create book stays in the header and Rename stays in the card menu. There is still no New-book tile and no sample book.
- **Börnste cover:** the soft round blob is the fog-blurred tree in the photo itself (c13). It is not a kit artifact, so it was left unchanged.
- **New qa checks (149 in total):**
  - no #D8DBE1 in src;
  - the chrome and input tone tokens, plus rendered values for the library bar, kit header and editor inputs;
  - R=G=B for surface tokens;
  - a rendered scan of every page for tinted near-greys, and for white outside paper;
  - text contrast on all 4 surfaces;
  - search and sort styling and behaviour;
  - the library's existing deviations still hold.

## What's new in v6 (0.6.0): welcome, library and grayscale

The approved prototype screens are ported from `uikit-welcome-proto`: welcome5 gives the welcome screen and the empty library, and welcome7 gives the library with books. The welcome7 editor is not ported.

- **Flow:** First run is one welcome screen with one text-only **Create Library** button. It opens the folder picker, then the empty library. The library top bar shows the library path and **Change**. Change still asks for confirmation before it opens the picker, and the missing-folder state with Retry is unchanged. The code is in `src/features/library.tsx` (`WelcomeScreen`, `LibraryBar`, `LibraryEmpty`, `HomeScreen`, `FirstRun`). `screens.tsx` re-exports `HomeScreen`.
- **Empty library:** it shows the example cover "Fog" labelled *Example*, the overline "Your library is ready", the headline "Your first story / starts here.", the sub text and **Create book** with no plus icon.
- **Library with books:** the 8 prototype books are shown as book objects (spine shading, page edge, title overlay) in 4:5 portrait, landscape and square formats. Each has a meta line, "N spreads · edited …". Hover only adds a drop shadow and a floor shadow, with no lift or transform. Focus is a 2 px #3A3839 outline, and reduced motion is respected. The New-book tile, search, sort and double-click rename are gone. Rename is in the card menu, and **Create book** sits in the header.
- **Grayscale, no blue:** `--t-accent` (#3A8AFA) and #2B73DB are gone.
  - Primary is ink #232223 with #F2F2F2 labels (14.2:1), hover #3A3839 (10.4:1). The focus ring is 2 px #3A3839.
  - Selection, the slider fill and the selection handles use #393738 (`--select`).
  - Links are foreground with an underline. The brand and parent badges are neutral, and the slate palette is now warm grey. The portrait slot colour is brown.
  - Secondary text stays #535152.
- **No icons in primary buttons:** icons were removed from every default-variant `<Button>` in the kit (19 places, including Export, Publish, Done, Add folder, Download and Retry). The saving spinner was removed too.
- **Photo credits in the kit chrome only:** the demo screens have no credit line and no Sources list. Under each demo frame that shows a Commons photo, `DemoCredits` (`src/kit/Credits.tsx`) adds a caption for each photo in exactly this form: "Photo: Author · CC BY-SA 4.0 · modified". It is 11 px #535152, the author links to the Commons file page and the license links to the CC deed, and the underline shows only on hover. The new **Photo credits** page (`#/credits`) is linked from the index footer. `#/full/<id>` stays a bare demo. `PHOTO-CREDITS.md` now has a TASL table for the 10 photos in `public/photos/hi/`, which were resized to ≤1400 px (≤2400 px for the welcome photo) and total 2.7 MB.
- **Tokens:** `text-2xs`, `text-md`, `text-subhead`, `text-lead`, `text-display`, `shadow-ink` and `shadow-ink-sm` are now registered in `@theme`. `text-2xs` was already used before v6 but no utility was generated for it, so those labels now render at 11 px.
- **QA (134 checks):** new checks cover:
  - no blue-hue hex or rgb values, no blue Tailwind classes and no retired accent in the src CSS and tsx, or in the built CSS;
  - primary buttons render as #232223 / #F2F2F2 with no svg on 17 pages, with a source check as well;
  - hover #3A3839, the ring, select and secondary tokens, and the rendered keyboard focus ring;
  - no blue on a selected frame;
  - the welcome → picker → empty library flow and its copy;
  - Change → confirm;
  - book-object formats, meta lines and hover without a lift;
  - credits: none inside a demo, exact chrome captions and links, underline on hover, `#/credits`, the footer link and the PHOTO-CREDITS rows.

  The old checks for the New-book tile and for #3A8AFA / #2B73DB were rewritten.
