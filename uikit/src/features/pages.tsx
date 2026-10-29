/* Stage 3: every kit feature page, grouped by roadmap area (src/kit/screens.json). Each page mounts only src/demo-parts
   (the parts #/demo is assembled from) at real editor slot sizes, offers its states through one scenario switcher, and
   its notes describe only what #/demo does. */
import * as React from "react"
import {
  DemoRoot, EditorView, PrintDialog, PublishDialog, SLOT, type RootInit,
} from "@/demo-parts"
import { LAKE_BOOK, LAKE_TITLE, docBlank, docAdded, docFilled, COVER_DONE, dbook, SHELF } from "@/demo-parts/fixtures"
import { WithScenarios } from "./parts"
import type { FeatureDef, Notes } from "./types"

/** Stage height = the #/demo viewport height (+ the 40 px scenario strip), so every slot sits at its #/demo size. */
const H = SLOT.app.h + 40
const PATH = "~/Pictures/Photobooks"

type Sc = [id: string, label: string, render: () => React.ReactNode]
function page(items: Sc[], notes: Notes, h = H): FeatureDef {
  function Demo() {
    return <WithScenarios items={items.map(([id, l]) => [id, l] as [string, string])}
      render={(v) => <div key={v} className="h-full" data-scenario={v}>{items.find((x) => x[0] === v)![2]()}</div>} />
  }
  return { Demo, notes, h }
}
/* #/demo session seeds */
const root = (init: RootInit) => () => <DemoRoot init={init} />
const lib = (init: RootInit["library"] = {}, books = SHELF()): RootInit => ({ session: { stage: "library", path: PATH, books }, library: init })
const inEditor = (o: Omit<RootInit, "session"> = {}, b = dbook("lake", LAKE_TITLE, { extras: undefined, doc: docAdded() })): RootInit => ({ session: { stage: "editor", path: PATH, books: [b], open: b.id, back: "library" }, ...o })
const onSite = (site: RootInit["site"], entry: "catalog" | "book" = "catalog"): RootInit => {
  const books = SHELF().map((b) => ({ ...b, published: true }))
  return { session: { stage: "site", path: PATH, books, open: books[0].id, back: "editor", siteEntry: entry }, site }
}
/* editor seeds (EditorView = the #/demo editor with an explicit studio state) */
const ed = (p: React.ComponentProps<typeof EditorView>) => () => <EditorView book={LAKE_BOOK} {...p} />

export const PAGES: Record<string, FeatureDef> = {
  /* ------------------------------------------------------------ library */
  "open-save-project": page([
    ["welcome", "Welcome", root({ session: { stage: "welcome" } })],
    ["picker", "Folder picker", root({ session: { stage: "welcome" }, welcome: { picking: true } })],
    ["empty", "Empty library", root(lib({}, []))],
    ["change", "Change folder", root(lib({ confirmChange: true }, []))],
  ], {
    what: "First run and the one library folder: the welcome screen’s Create Library opens a folder picker; the chosen folder opens as the (empty) library. The library bar shows the folder path with Change.",
    where: "#/demo steps 1–4: start of the demo, then the library bar’s Change.",
    edge: ["Picker cancelled → back to the welcome screen", "Change asks first: books stay in the old folder, nothing is moved or deleted; Choose folder… opens the picker"],
  }),
  "recents-home": page([
    ["books", "Books", root(lib())],
    ["search", "Search: no results", root(lib({ query: "zzz" }))],
    ["rename", "Rename", root(lib({ renaming: "lake" }))],
    ["remove", "Remove confirm", root(lib({ removing: "tatra" }))],
  ], {
    what: "The library: books as book objects with a meta line, a book count, Create book, Search books and Sort. Each book’s ⋯ menu has Open, Rename (inline title field), Duplicate and Remove… (confirm).",
    where: "#/demo steps 41–48: back from the editor to the library.",
    edge: ["Search with no match → “No books match …” with Clear search", "Rename: Enter saves, Esc cancels, an empty title keeps the old one", "Remove deletes the book from the library folder only; photos stay on disk", "Duplicate adds “(copy)” at the top, unpublished"],
  }),
  /* ------------------------------------------------------------ create book */
  "spread-templates-ui": page([
    ["first", "First book", root(lib({ creating: true }, []))],
    ["more", "With books", root(lib({ creating: true }))],
  ], {
    what: "Create book dialog: a title and a page size (presets A6…Square 30×30, or Custom size with width × height in cm, 10–42). Create opens the new blank book in the editor.",
    where: "#/demo steps 5–8: the empty library’s Create book (or Create book in the library header).",
    edge: ["Empty title → “Untitled book”", "Custom values are clamped to 10–42 cm", "Esc / Cancel closes without creating"],
  }),
  /* ------------------------------------------------------------ editor chrome */
  "editor-chrome-toolbar": page([
    ["blank", "New book", root(inEditor({}, dbook("lake", LAKE_TITLE, { doc: docBlank(), extras: undefined })))],
    ["photos", "With photos", root(inEditor())],
    ["preview", "Preview", root(inEditor({ editor: { preview: true } }))],
  ], {
    what: "The editor chrome: top bar with Library, tools, undo / redo, snap and grid toggles, zoom, save status and the book title (opens Book settings), then Preview · Settings · Print · Publish. Spread list left, inspector right, photos dock below.",
    where: "#/demo steps 8–26 and 39–40 (the whole editor).",
    edge: ["Preview opens the book as the site shows it, full screen; Esc or Close returns", "Settings opens app settings with “Back to the book”"],
  }),
  /* ------------------------------------------------------------ filmstrip */
  "editor-shell-filmstrip": page([
    ["empty", "No photos", ed({ doc: docBlank, slots: { left: false, right: false } })],
    ["added", "Folder added", ed({ doc: docAdded, slots: { left: false, right: false } })],
    ["placed", "Photos placed", ed({ doc: docFilled, cur: 1, slots: { left: false, right: false } })],
  ], {
    what: "The photos dock (filmstrip) under the canvas: one row of photo thumbnails with file names and an Add folder… button. Adding a folder brings in all its photos; drag a thumbnail onto a frame to place it.",
    where: "#/demo steps 10–12 (Add folder… → picker → photos), 15 (drop on a frame).",
    edge: ["A folder with no new photos → status line “… has no new photos”", "Hover shows the photo’s file name"],
  }),
  /* ------------------------------------------------------------ spread list */
  "spread-list-panel": page([
    ["cover", "Cover", ed({ doc: docAdded, cur: 0, node: { k: "cover" }, slots: { right: false } })],
    ["spread", "Spread 1", ed({ doc: docFilled, cur: 1, slots: { right: false } })],
    ["masters", "Masters", ed({ doc: docFilled, cur: 1, mode: "masters", node: { k: "master", id: "A" }, slots: { right: false } })],
  ], {
    what: "The spread list (left panel, 212 px): cover, endpapers and spreads as thumbnails with a Pages / Masters switch and Add spread. Clicking an item shows it on the canvas.",
    where: "#/demo steps 9 (cover), 14 (spread 1), 21–23 (Masters / Pages), 25 (endpaper).",
    edge: ["Masters mode lists the master spreads A and B instead of pages"],
  }),
  /* ------------------------------------------------------------ canvas */
  "pasteboard-workspace": page([
    ["spread", "Spread", ed({ doc: docFilled, cur: 1 })],
    ["cover", "Cover", ed({ doc: docFilled, cur: 0, node: { k: "cover" }, extras: COVER_DONE })],
    ["selected", "Spread selected", ed({ doc: docFilled, cur: 1, node: { k: "none" } })],
  ], {
    what: "The canvas: one spread (or the cover) centred on a grey pasteboard, with a status line. Clicking the pasteboard selects the spread.",
    where: "#/demo steps 13–20.",
    edge: ["The cover shows back · spine · front with editable title text"],
  }),
  "drag-place-replace": page([
    ["empty", "Empty frames", ed({ doc: docAdded, cur: 1 })],
    ["placed", "Photos placed", ed({ doc: docFilled, cur: 1 })],
  ], {
    what: "Drag a filmstrip photo onto a frame to place it; dropping on a filled frame replaces its photo.",
    where: "#/demo step 15 (photo dropped in a frame), 13 (photo onto the cover).",
    edge: ["Placed photos are marked in the filmstrip"],
  }),
  "frame-selection-handles": page([
    ["one", "Frame selected", ed({ doc: docFilled, cur: 1, pick: 0 })],
    ["multi", "Two frames", ed({ doc: docFilled, cur: 1, pick: [0, 1] })],
  ], {
    what: "Click a frame to select it: handles on the frame, frame properties in the inspector. Drag moves the frame; Esc during a drag cancels it.",
    where: "#/demo steps 16–18.",
    keys: [["Esc", "cancel the drag / clear the selection"]],
    edge: ["Esc mid-drag puts the frame back where it was"],
  }),
  "crop-in-frame": page([
    ["crop", "Crop mode", ed({ doc: docFilled, cur: 1, pick: 0, crop: true })],
    ["frame", "Before crop", ed({ doc: docFilled, cur: 1, pick: 0 })],
  ], {
    what: "Crop mode for the selected frame: the whole photo shows around the frame and can be moved and scaled inside it; the crop is stored, the photo file is untouched.",
    where: "#/demo step 19 (inspector → Crop).",
    keys: [["Esc", "leave crop mode"]],
    edge: ["Esc leaves crop mode, a second Esc clears the selection"],
  }),
  /* ------------------------------------------------------------ layout grids / masters */
  "parent-spreads": page([
    ["a", "Master A", ed({ doc: docFilled, cur: 1, mode: "masters", node: { k: "master", id: "A" } })],
    ["b", "Master B", ed({ doc: docFilled, cur: 1, mode: "masters", node: { k: "master", id: "B" } })],
  ], {
    what: "Masters mode: the spread list shows master spreads A and B; the selected master is shown on the canvas and edited in the inspector.",
    where: "#/demo steps 21–23 (spread list → Masters, then back to Pages).",
    edge: ["Pages switches back to the book spreads"],
  }),
  "layout-grids-settings": page([
    ["grid", "Master grid", ed({ doc: docFilled, cur: 1, mode: "masters", node: { k: "master", id: "A" }, slots: { dock: false } })],
    ["spread", "Spread grid", ed({ doc: docFilled, cur: 1, node: { k: "none" }, slots: { dock: false } })],
  ], {
    what: "Layout grid fields (columns, rows, margins, gutter) for a master spread in the inspector; the canvas redraws the grid as values change.",
    where: "#/demo step 22 (master grid set to 5 columns).",
    edge: ["Values outside the field range are clamped"],
  }),
  "layout-grids-render-snap": page([
    ["grid", "Grid on", ed({ doc: docFilled, cur: 1, view: { grid: true, snap: true } })],
    ["off", "Grid off", ed({ doc: docFilled, cur: 1, view: { grid: false, snap: false } })],
  ], {
    what: "Snap and grid toggles in the top bar: show the layout grid on the canvas and snap frames to it while dragging.",
    where: "#/demo editor top bar (steps 8–26).",
    edge: ["Toggles affect the view only, not the book"],
  }),
  /* ------------------------------------------------------------ inspector */
  inspector: page([
    ["frame", "Frame", ed({ doc: docFilled, cur: 1, pick: 0, slots: { left: false, dock: false } })],
    ["spread", "Spread", ed({ doc: docFilled, cur: 1, node: { k: "none" }, slots: { left: false, dock: false } })],
    ["book", "Book settings", ed({ doc: docFilled, cur: 1, node: { k: "book" }, slots: { left: false, dock: false } })],
    ["endpaper", "Endpaper", ed({ doc: docFilled, cur: 1, node: { k: "endpaper", w: "front" }, slots: { left: false, dock: false } })],
  ], {
    what: "The inspector (right panel, 300 px) follows the selection: a frame (photo, crop, geometry, arrange), the spread (layout, background, grid), Book settings (title, size, endpapers) or an endpaper.",
    where: "#/demo steps 16 (frame), 20 (spread), 24 (book title → Book settings), 25 (endpaper).",
    edge: ["Nothing selected → spread properties", "Book settings stays until another item is clicked"],
  }),
  "cover-editor": page([
    ["blank", "New cover", ed({ doc: docAdded, cur: 0, node: { k: "cover" } })],
    ["done", "Photo + title", ed({ doc: docAdded, cur: 0, node: { k: "cover" }, extras: COVER_DONE })],
  ], {
    what: "The cover: back · spine · front on the canvas; drop a photo on the front, edit the front / spine / back text in place or in the inspector.",
    where: "#/demo steps 9 and 13.",
    edge: ["A new book’s cover text is its title"],
  }),
  /* ------------------------------------------------------------ settings */
  "site-settings": page(([["library", "Library"], ["hosting", "Hosting"], ["site", "Site"], ["print", "Print presets"], ["interface", "Interface"]] as const).map(([id, l]) =>
    [id, l, root({ session: { stage: "settings", path: PATH, books: SHELF(), back: "library" }, settings: { section: id } })] as Sc), {
    what: "App settings with a back bar: Library (folder, Change library folder…), Hosting, Site (title, author), Print presets, Interface.",
    where: "#/demo steps 40 (editor → Settings, back bar “Back to the book”) and 49 (library → Settings, back bar “Library”).",
    edge: ["Change library folder… confirms first; books are not moved"],
  }),
  /* ------------------------------------------------------------ site */
  "site-viewer": page([
    ["catalog", "Catalog", root(onSite({}))],
    ["book", "Book", root(onSite({ page: "book" }, "book"))],
  ], {
    what: "The published site: a catalog of published books, then one book’s viewer with spreads, Share and Fullscreen. A bar above it returns to the editor.",
    where: "#/demo steps 35–38 (Publish → Open site).",
    edge: ["Share copies the book link", "Esc leaves fullscreen"],
  }),
  "site-lightbox": page([
    ["lightbox", "Fullscreen", root(onSite({ page: "book", lb: true }, "book"))],
    ["spread", "Spread 2", root(onSite({ page: "book", spread: 2, lb: true }, "book"))],
  ], {
    what: "Fullscreen viewing of one book on the site; arrows step through spreads.",
    where: "#/demo step 38.",
    keys: [["← / →", "previous / next spread"], ["Esc", "close"]],
  }),
  "site-preview-mode": page([
    ["preview", "Preview", root(inEditor({ editor: { preview: true } }, dbook("lake", LAKE_TITLE, { extras: { ...dbook("x", LAKE_TITLE).extras!, ...COVER_DONE } })))],
  ], {
    what: "Preview from the editor: the current book in the site viewer, full screen, without publishing.",
    where: "#/demo step 26 (top bar → Preview).",
    edge: ["Close / Esc returns to the editor"],
  }),
  /* ------------------------------------------------------------ print */
  "pdf-export": page([
    ["opts", "Options", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} /> })],
    ["4up", "4-up, no bleed", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} initialImposition="4up" initialBleed={false} /> })],
    ["run", "Exporting", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} initialStep="run" /> })],
    ["done", "PDF ready", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} initialStep="done" /> })],
  ], {
    what: "Print dialog over the editor: page size, imposition for duplex (1 per sheet, 2-up, 4-up) and “Add 3 mm bleed and crop marks”; Export PDF shows progress, then PDF ready with Show in folder.",
    where: "#/demo steps 27–31 (top bar → Print).",
    edge: ["Sheet count follows the imposition", "Exporting runs to PDF ready on its own"],
  }),
  /* ------------------------------------------------------------ publish */
  "in-app-publish": page([
    ["opts", "Options", ed({ doc: docFilled, cur: 1, overlay: <PublishDialog title={LAKE_TITLE} onClose={() => {}} /> })],
    ["run", "Publishing", ed({ doc: docFilled, cur: 1, overlay: <PublishDialog title={LAKE_TITLE} onClose={() => {}} initialStep="run" /> })],
    ["done", "Published", ed({ doc: docFilled, cur: 1, overlay: <PublishDialog title={LAKE_TITLE} onClose={() => {}} initialStep="done" /> })],
  ], {
    what: "Publish dialog over the editor: web image size (1600 / 2048 / 3200 px) and “Let visitors download a PDF”; Publish shows progress, then Published with Open site.",
    where: "#/demo steps 32–34 (top bar → Publish).",
    edge: ["Open site goes to the site catalog (#/demo step 35)"],
  }),
}
