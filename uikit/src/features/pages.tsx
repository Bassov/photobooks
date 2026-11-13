/* Stage 3: every kit feature page, grouped by roadmap area (src/kit/screens.json). Each page mounts only src/demo-parts
   (the parts #/demo is assembled from) at real editor slot sizes, offers its states through one scenario switcher, and
   its notes describe only what #/demo does. */
import * as React from "react"
import {
  DemoRoot, EditorView, PrintDialog, PublishDialog, SLOT, type RootInit,
} from "@/demo-parts"
import { LAKE_BOOK, LAKE_TITLE, docBlank, docAdded, docFilled, COVER_DONE, dbook, SHELF } from "@/demo-parts/fixtures"
import { pickPrint, profileById } from "@/demo-parts/printProfiles"
import { ExportSiteDialog, type ExportRun } from "@/demo-parts/dialogs"
import type { PrintInit, SettingsSection } from "@/demo-parts/settings"
import { SAMPLE_HOSTING, type SessionState } from "@/demo-parts/session"
import type { HostingDraft, HostingInit } from "@/demo-parts/hosting"
import type { Doc } from "@/sandbox/model"
import { WithScenarios } from "./parts"
import { BooksCount, COUNTS } from "./site-book/many"
import { PersonalSite } from "./site/home"
import type { FeatureDef, Notes } from "./types"

/** Stage height = the #/demo viewport height (+ the 40 px scenario strip), so every slot sits at its #/demo size. */
const H = SLOT.app.h + 40
const PATH = "~/Pictures/Photobooks"
/* static-export: books from earlier exports (newest first) and a run frozen at 42 % */
const EXPORTED = ["Fog", "Summer ’25"]
const RUN_42: ExportRun = { phase: "run", p: 42, fail: "unknown", folder: "Sites", start: () => {}, seen: () => {} }

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
/** site-preview-mode: the Lake trip book with the cover done */
const lakePreview = dbook("lake", LAKE_TITLE, { extras: { ...dbook("x", LAKE_TITLE).extras!, ...COVER_DONE } })
const onSite = (site: RootInit["site"], entry: "catalog" | "book" = "catalog"): RootInit => {
  const books = SHELF().map((b) => ({ ...b, published: true }))
  return { session: { stage: "site", path: PATH, books, open: books[0].id, back: "editor", siteEntry: entry }, site }
}
const settingsAt = (section: SettingsSection, s: Partial<SessionState> = {}, print?: PrintInit, hosting?: HostingInit) =>
  root({ session: { stage: "settings", path: PATH, books: SHELF(), back: "library", ...s }, settings: { section, print, hosting } })
/* publish-credentials: a valid draft (key and secret are low-entropy fakes) and the hosting seeds */
const DRAFT: HostingDraft = { account: SAMPLE_HOSTING.accountId, bucket: SAMPLE_HOSTING.bucket, key: `${"ab".repeat(14)}9f2c`, secret: "5e".repeat(32), url: SAMPLE_HOSTING.publicBaseUrl }
const hostingAt = (s: Partial<SessionState>, h?: HostingInit) => settingsAt("hosting", s, undefined, h)
/* editor seeds (EditorView = the #/demo editor with an explicit studio state) */
const ed = (p: React.ComponentProps<typeof EditorView>) => () => <EditorView book={LAKE_BOOK} {...p} />
/* cover-editor: 60 spreads = 120 pages, the widest generic spine (32 mm) */
const docThick = (): Doc => ({ ...docAdded(), spreads: Array.from({ length: 6 }, () => docAdded().spreads).flat().slice(0, 60) })
/** docFilled with the third frame of spread 2 (three frames) locked. */
const docThreeOneLocked = (): Doc => {
  const d = docFilled()
  return { ...d, spreads: d.spreads.map((s, i) => (i === 2 ? { ...s, frames: s.frames.map((f, j) => (j === 2 ? { ...f, locked: true } : f)) } : s)) }
}

/** personal-site (D35): the scenario is the book count (site-book/many `BooksCount`; the route hash is left alone);
   #/full shows the site alone and takes `?books=` from the URL */
function PersonalSitePage() {
  if (location.hash.startsWith("#/full/")) return <PersonalSite />
  return <WithScenarios items={COUNTS.map((c) => [`${c}`, `${c} book${c === 1 ? "" : "s"}`])} initial="6"
    render={(v) => <div key={v} className="h-full" data-scenario={v}><BooksCount.Provider value={+v}><PersonalSite /></BooksCount.Provider></div>} />
}

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
    what: "The editor chrome: top bar with Library, tools, undo / redo, snap and grid toggles, zoom, save status and the book title (opens Book settings), then Preview · Settings · Export site · Print · Publish. Spread list left, inspector right, photos dock below.",
    where: "#/demo steps 8–26 and 39–40 (the whole editor); Export site in steps 52–55.",
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
    what: "The spread list (left panel, 212 px): cover, endpapers and spreads as thumbnails with a Pages / Masters switch; a row's menu adds a spread after it. Clicking an item shows it on the canvas.",
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
    ["multi", "Two frames", ed({ doc: docFilled, cur: 2, pick: [0, 1] })],
    ["locked", "Three frames, one locked", ed({ doc: docThreeOneLocked, cur: 2, pick: [0, 1, 2] })],
  ], {
    what: "Click a frame to select it: handles on the frame, frame properties in the inspector. Drag moves the frame or the whole set; Esc cancels the move. Shift+click adds or removes a frame: with two or more selected, every frame keeps its outline, a dashed group box surrounds them and no frame shows handles.",
    where: "#/demo steps 16–18.",
    keys: [["Shift+click", "add / remove a frame"], ["Drag on paper or pasteboard", "marquee: select the frames it touches; Shift adds"], ["Arrows / Shift+arrows", "nudge the selection by 1 / 10 mm"], ["Del", "delete the selected frames"], ["Esc", "cancel the move or marquee / clear the selection"]],
    edge: ["Esc mid-move puts the frame or the whole set back; mid-marquee, the previous selection", "A marquee from the gray targets the spread with the nearest paper and makes it active", "Shift+click never swaps photos", "A plain click inside the selection selects that frame alone", "Locked frames can be selected and stay put on move, nudge, align and distribute; all locked: the status says so"],
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
    /* printer-presets: Lulu picked on a 15 × 23 cm, 20-page book — page width and page count warnings */
    ["book-lulu", "Lulu picked", ed({ doc: () => ({ ...docFilled(), print: pickPrint(profileById("lulu-photo-book", []), 3) }), book: { ...LAKE_BOOK, w: 15 }, cur: 1, node: { k: "book" }, slots: { left: false, dock: false } })],
    ["endpaper", "Endpaper", ed({ doc: docFilled, cur: 1, node: { k: "endpaper", w: "front" }, slots: { left: false, dock: false } })],
  ], {
    what: "The inspector (right panel, 300 px) follows the selection: a frame (photo, crop, geometry, arrange), the spread (layout, background, grid), Book settings (size, endpapers, printer) or an endpaper.",
    where: "#/demo steps 16 (frame), 20 (spread), 24 (book title → Book settings), 25 (endpaper).",
    edge: ["Nothing selected → spread properties", "Book settings stays until another item is clicked"],
  }),
  "cover-editor": page([
    ["blank", "New cover", ed({ doc: docAdded, cur: 0, node: { k: "cover" } })],
    ["done", "Photo + title", ed({ doc: docAdded, cur: 0, node: { k: "cover" }, extras: COVER_DONE })],
    ["thick", "120 pages", ed({ doc: docThick, cur: 0, node: { k: "cover" }, extras: COVER_DONE })],
  ], {
    what: "The cover: back · spine · front with the wrap band, hinge strips and safe frames; spine width from the print profile and page count.",
    where: "#/demo steps 9 and 13.",
    edge: ["A new book’s cover text is its title"],
  }),
  /* ------------------------------------------------------------ settings */
  "site-settings": page([
    ...(([["library", "Library"], ["hosting", "Hosting"], ["site", "Site"], ["print", "Print presets"], ["interface", "Interface"]] as const).map(([id, l]) =>
      [id, l, settingsAt(id, id === "print" ? { defaultPrintProfileId: "lulu-photo-book" } : {})] as Sc)),
    ["print-empty", "No custom profiles", settingsAt("print", { printProfiles: [] })],
    ["print-edit", "Edit profile", settingsAt("print", {}, { edit: "custom-lulu-copy" })],
    ["print-invalid", "Invalid values", settingsAt("print", {}, { edit: "new", draft: { name: "", trimMin: "300", trimMax: "200", pMax: "121" } })],
    ["hosting-empty", "Not connected", hostingAt({ hosting: null })],
    ["hosting-invalid", "Format errors", hostingAt({ hosting: null }, { draft: { ...DRAFT, account: "0f3a9c51e2b74d0a8c66f1e9d3b", bucket: "Aleksandr_Books", url: "https://pub-41c2a0.r2.dev" } })],
    ["hosting-checking", "Checking", hostingAt({ hosting: null }, { draft: DRAFT, checking: true })],
    ["hosting-cors", "Check failed", hostingAt({ hosting: null }, { draft: DRAFT, fail: "Cors" })],
    ["hosting-recheck-failed", "Re-check failed", hostingAt({ hosting: { ...SAMPLE_HOSTING, checkedAtMs: SAMPLE_HOSTING.checkedAtMs + 11 * 60_000, ok: false, code: "InvalidAccessKeyId" } })],
    ["hosting-replace", "Replace token", hostingAt({}, { replace: true })],
    ["hosting-forget", "Forget token", hostingAt({}, { forget: true })],
  ], {
    what: "App settings with a back bar: Library (folder, Change library folder…), Hosting (Cloudflare R2 token: entry form, connected card, help), Site (title, author, intro = the site's home lead), Print presets (default for new books, print shops, custom profiles and their editor), Interface.",
    where: "#/demo steps 40 (editor → Settings, back bar “Back to the book”) and 49 (library → Settings, back bar “Library”); Print presets only here.",
    edge: ["Change library folder… confirms first; books are not moved", "Profile editor: errors show as you type and disable Save", "Deleting the default profile makes Generic the default", "The secret is never shown again", "Connect checks a real write before saving"],
  }),
  /* ------------------------------------------------------------ site */
  "site-lightbox": page([
    ["lightbox", "Fullscreen", root(onSite({ page: "book", lb: true }, "book"))],
    ["spread", "Spread 2", root(onSite({ page: "book", slide: 3, lb: true }, "book"))],
    ["zoomed", "Zoomed 2×", root(onSite({ page: "book", slide: 3, lb: true, lbZoom: 2 }, "book"))],
  ], {
    what: "Fullscreen viewing of one book from the reading room (Fullscreen in the foot); arrows step through spreads.",
    where: "#/demo step 59.",
    keys: [["← / →, Space", "previous / next spread"], ["Esc", "close"]],
    edge: ["Double-click or pinch zooms; drag pans", "Arrows hide on touch screens"],
  }),
  "personal-site": {
    Demo: PersonalSitePage, h: SLOT.app.h, notes: {
      what: "The personal site: a bookcase home (the newest book of each shelf face-out) and a reading room with the open book. Sample books.",
      where: "#/demo Open site and Preview (the session's published books). Full window: #/full/personal-site?books=1|3|6|12|30|100 (&book=<id> opens a book).",
      keys: [["← / →", "turn"], ["Esc / Back", "close the book"]],
      edge: ["The page scrolls down the case", "Phone reads in Page turn; &reader=carousel gives the carousel", "Room foot: Share · Fullscreen · Play; phones: Share only"],
    },
  },
  "site-preview-mode": page([
    ["preview", "Preview", root(inEditor({ editor: { preview: true } }, lakePreview))],
    ["spread", "Spread 2", root(inEditor({ editor: { preview: { slide: 2 } } }, lakePreview))],
    ["fullscreen", "Fullscreen", root(inEditor({ editor: { preview: { lb: true } } }, lakePreview))],
  ], {
    what: "Preview from the editor: the reading room of the current book under a 48 px bar, without publishing; Fullscreen = the site lightbox",
    where: "#/demo step editor-preview (top bar → Preview).",
    keys: [["← / →", "turn"], ["Home / End", "cover / last spread"], ["Esc", "closes Fullscreen, then the preview"]],
    edge: ["Share, All books and the home hidden; opens at page 1; the editor is unchanged after Esc"],
  }),
  /* ------------------------------------------------------------ print */
  "pdf-export": page([
    ["opts", "Options", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} /> })],
    ["4up", "4-up, no bleed", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} initialImposition="4up" initialBleed={false} /> })],
    ["run", "Exporting", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} initialStep="run" /> })],
    ["done", "PDF ready", ed({ doc: docFilled, cur: 1, overlay: <PrintDialog book={LAKE_BOOK} spreads={10} title={LAKE_TITLE} onClose={() => {}} initialStep="done" /> })],
  ], {
    what: "Print dialog over the editor: page size, the book’s printer profile, imposition for duplex (1 per sheet, 2-up, 4-up) and “Add 3 mm bleed and crop marks”; Export PDF shows progress, then PDF ready with Show in folder.",
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
    where: "#/demo steps 49–51 (top bar → Publish).",
    edge: ["Open site goes to the site catalog (#/demo step 56)"],
  }),
  /* ------------------------------------------------------------ static export */
  "static-export": page([
    ["opts-empty", "Options, no folder", ed({ doc: docFilled, cur: 1, overlay: <ExportSiteDialog title={LAKE_TITLE} otherBooks={EXPORTED} onHide={() => {}} /> })],
    ["opts", "Options", ed({ doc: docFilled, cur: 1, overlay: <ExportSiteDialog title={LAKE_TITLE} otherBooks={EXPORTED} folder="Sites" onHide={() => {}} /> })],
    ["run", "Exporting", ed({ doc: docFilled, cur: 1, exportSite: { phase: "run", p: 42 }, overlay: <ExportSiteDialog title={LAKE_TITLE} otherBooks={EXPORTED} folder="Sites" initialStep="run" run={RUN_42} onHide={() => {}} /> })],
    ["run-hidden", "Hidden, 42 %", ed({ doc: docFilled, cur: 1, exportSite: { phase: "run", p: 42 } })],
    ["done", "Exported", ed({ doc: docFilled, cur: 1, exportSite: { phase: "done", p: 0 }, overlay: <ExportSiteDialog title={LAKE_TITLE} otherBooks={EXPORTED} folder="Sites" initialStep="done" onHide={() => {}} /> })],
    ["failed", "Failed", ed({ doc: docFilled, cur: 1, exportSite: { phase: "failed", p: 0 }, overlay: <ExportSiteDialog title={LAKE_TITLE} otherBooks={EXPORTED} folder="Sites" initialStep="failed" fail="access" onHide={() => {}} /> })],
  ], {
    what: "Export site: the top-bar pill after Settings opens a dialog that writes the site of your books to a folder on this computer (Folder, Books, Export), shows progress, then Site exported with how to serve it. Nothing is uploaded.",
    where: "#/demo steps 52–55 (top bar → Export site → Choose folder… → Export → Hide → Exported).",
    keys: [["Esc", "closes the dialog (Hide while running); the export keeps running in the pill"]],
    edge: ["The pill keeps its width in every state: NN% over a fill while running, “Exported” for 4 s, “Failed” until opened", "Below a 1280 px window the pill is icon-only, 40 × 32", "Picker folder “Family” holds a foreign dist: “isn’t a Photobooks export”, Choose folder… goes back to Options"],
  }),
}
