/* Product guide copy (Designer spec product-walkthrough, 2026-11-12). Markup in step texts: `key` → Kbd, *italic*.
 * Quoted control labels are the exact kit labels; keys and gestures exist in both the kit and prod. */

export type PartId = 1 | 2 | 3 | 4 | 5
export type Step = { text: string; coming?: string }
/** A selector (Playwright syntax) or a rect [x, y, w, h] in the 1440 × 900 #/demo viewport. */
export type Clip = string[] | [number, number, number, number] | null
export type Callout = { n: number; sel: string }
export type Figure = { step: string; clip: Clip; callouts: Callout[] }
export type Chapter = {
  id: string
  n: number
  toc: string
  title: string
  part: PartId
  /** roadmap slug when the feature is not in prod yet */
  coming?: string
  /** two: steps beside a 504 figure · wide: 868 figure + legend · stack: steps above an 868 figure (wide, short clips) */
  layout: 'two' | 'wide' | 'stack'
  solves: string
  steps: Step[]
  /** wide chapters with a whole-editor figure: a 5-column legend instead of steps */
  legend?: { name: string; text: string }[]
  figure?: Figure
  kit: string[]
  /** link "Try it in the demo" (the In-the-app chapters) */
  demo: boolean
}

export const PARTS: { id: PartId; name: string; text: string }[] = [
  { id: 1, name: 'Start', text: 'Pick a library folder and create a book.' },
  {
    id: 2,
    name: 'Make the book',
    text: 'Add photos, drop them on pages, pick layouts.',
  },
  { id: 3, name: 'Polish', text: 'Crop, text, masters, cover, a final check.' },
  {
    id: 4,
    name: 'Print',
    text: 'A PDF for a shop, or sheets to fold at home.',
  },
  { id: 5, name: 'Share', text: 'Your books as a website.' },
]

const s = (text: string, coming?: string): Step =>
  coming ? { text, coming } : { text }
const FRAME = '[data-testid="canvas"] [data-current] [data-testid="frame"]'

export const CHAPTERS: Chapter[] = [
  {
    id: 'library-folder',
    n: 1,
    part: 1,
    toc: 'Your library folder',
    title: 'Your library folder',
    layout: 'two',
    demo: true,
    solves:
      'your books and photos stay in a folder you own: no account, no upload, works offline.',
    steps: [
      s(
        "Open Photobooks in Chrome or Edge on a computer; other browsers can't open folders, and the app tells you so.",
      ),
      s(
        '"Create Library" picks an empty folder for your books, or choose a folder that already holds a library.',
      ),
      s('Allow the browser to read and write it.'),
      s('To move it later: Library → "Change library folder…".'),
    ],
    figure: {
      step: 'welcome-folder-picker',
      clip: null,
      callouts: [
        { n: 1, sel: '[data-testid="create-library"]' },
        { n: 2, sel: '[data-testid="picker-select"]' },
      ],
    },
    kit: ['open-save-project'],
  },
  {
    id: 'your-books',
    n: 2,
    part: 1,
    toc: 'Your books',
    title: 'Your books',
    layout: 'stack',
    demo: true,
    solves: 'every book in one place, found in seconds by name.',
    steps: [
      s('Click a book to open it.'),
      s('The ••• menu on a card: Rename, Duplicate, Remove… (it asks first).'),
      s('Sort by the menu next to search; type to search by title.'),
    ],
    figure: {
      step: 'library-book-menu',
      clip: [
        '[data-testid="demo"] [data-testid="library-bar"]',
        '[data-testid="demo"] [data-testid="book-grid"]',
        '[role=menu]',
      ],
      callouts: [
        { n: 1, sel: '[data-testid="demo"] [data-testid="book-cover"]' },
        { n: 2, sel: '[role=menu]' },
        { n: 3, sel: '[data-testid="demo"] [data-testid="lib-search"]' },
      ],
    },
    kit: ['recents-home'],
  },
  {
    id: 'create-book',
    n: 3,
    part: 1,
    toc: 'Create a book',
    title: 'Create a book',
    layout: 'two',
    demo: true,
    solves: 'choose the print size first, so every layout fits the paper.',
    steps: [
      s('"Create book", type a title.'),
      s('Pick a page size (A5, A4, Square…) or "Custom size…" in cm.'),
      s('Portrait or Landscape (sizes that are not square).'),
      s('"Create book": the book opens with a cover, endpapers and blank spreads.'),
    ],
    figure: {
      step: 'create-book-size-menu',
      clip: ['[role=dialog]', '[role=listbox]'],
      callouts: [],
    },
    kit: ['spread-templates-ui'],
  },
  {
    id: 'editor',
    n: 4,
    part: 2,
    toc: 'The editor at a glance',
    title: 'The editor at a glance',
    layout: 'wide',
    demo: true,
    solves:
      'one screen for the whole book, and the selection decides what the right panel shows, so you never hunt through menus.',
    steps: [],
    legend: [
      { name: 'Top bar', text: 'Library, book title, tools, Undo, Preview.' },
      {
        name: 'Spreads',
        text: 'Cover, endpapers and every spread; Pages / Masters.',
      },
      {
        name: 'Canvas',
        text: 'The book at print size; scroll through spreads.',
      },
      { name: 'Inspector', text: 'Settings for what is selected.' },
      { name: 'Photos', text: 'Your folder; drag a photo onto a page.' },
    ],
    figure: {
      step: 'editor-spread-1',
      clip: null,
      callouts: [
        { n: 1, sel: '[data-testid="book-title"]' },
        { n: 2, sel: '[data-item="cover"]' },
        { n: 3, sel: '[data-testid="canvas"]' },
        { n: 4, sel: '[data-testid="inspector"]' },
        { n: 5, sel: '[data-testid="filmstrip"]' },
      ],
    },
    kit: ['editor-chrome-toolbar', 'pasteboard-workspace'],
  },
  {
    id: 'add-photos',
    n: 5,
    part: 2,
    toc: 'Add photos',
    title: 'Add photos',
    layout: 'stack',
    demo: true,
    solves: 'use photos straight from your folders, with no import copies.',
    steps: [
      s('"Add folder…" in the Photos dock.'),
      s(
        'Thumbnails appear as the folder is read; the dock scrolls sideways.',
      ),
      s('"Unplaced" shows only photos not yet in the book.'),
      s('A "Low-res" chip marks photos too small to print sharp at page size.'),
    ],
    figure: {
      step: 'editor-photos-added',
      clip: [0, 580, 1440, 320],
      callouts: [
        { n: 1, sel: '[data-testid="demo-add-folder"]' },
        { n: 3, sel: '[data-testid="film-unplaced-only"]' },
        { n: 4, sel: '[data-testid="lowres-chip"]' },
      ],
    },
    kit: ['editor-shell-filmstrip'],
  },
  {
    id: 'place',
    n: 6,
    part: 2,
    toc: 'Place, replace, swap',
    title: 'Place, replace, swap',
    layout: 'two',
    demo: true,
    solves:
      "a photo goes where you drop it and the frame crops it to fit, so you don't lay out pages by hand.",
    steps: [
      s(
        'Drag a photo from the dock onto an empty frame; it fills the frame and nothing is stretched.',
      ),
      s('Drop on a frame that has a photo to replace it.'),
      s('Drag a placed photo onto another frame to swap them; `Esc` cancels.'),
      s('Drop between two spreads on "Drop here for a new spread".'),
    ],
    figure: {
      step: 'editor-frame-selected',
      clip: ['[data-testid="canvas"]'],
      callouts: [{ n: 2, sel: FRAME }],
    },
    kit: ['drag-place-replace'],
  },
  {
    id: 'layouts',
    n: 7,
    part: 2,
    toc: 'Layouts and templates',
    title: 'Layouts and templates',
    layout: 'two',
    demo: true,
    solves: 'a finished page in one click instead of placing frames by hand.',
    steps: [
      s('Click a spread to select it.'),
      s(
        'LAYOUT in the inspector: filter by photo count; click a tile to apply, and photos keep their order.',
      ),
      s('"Save as template" keeps your own layout under My templates.'),
      s('"Contact sheet" fills the spread with a grid of columns × rows.'),
    ],
    figure: {
      step: 'editor-spread-selected',
      clip: [888, 120, 552, 640],
      callouts: [
        { n: 2, sel: '[data-testid="tpl-chips"]' },
        { n: 2, sel: '[data-testid="tpl-grid"] > :nth-child(2)' },
        { n: 3, sel: '[data-testid="tpl-save-button"]' },
      ],
    },
    kit: ['inspector'],
  },
  {
    id: 'spreads',
    n: 8,
    part: 2,
    toc: 'Spreads and pages',
    title: 'Spreads and pages',
    layout: 'two',
    demo: true,
    solves: "see the book's order at a glance and change it fast.",
    steps: [
      s(
        'The left panel lists cover, endpapers and every spread; the first and last pages stand alone.',
      ),
      s('Drag a row to reorder.'),
      s('The row ••• menu: Add after, Duplicate, Delete.'),
      s("Page count: Book settings → Binding shows the pages and the printer's range (20–120); add or delete spreads to change it, 2 pages each."),
    ],
    figure: {
      step: 'editor-spread-row-menu',
      clip: [0, 36, 560, 660],
      callouts: [{ n: 3, sel: '[role=menu]' }],
    },
    kit: ['spread-list-panel'],
  },
  {
    id: 'frames',
    n: 9,
    part: 3,
    toc: 'Frames and crop',
    title: 'Frames and crop',
    layout: 'two',
    demo: true,
    solves: 'exact control where a layout is not enough.',
    steps: [
      s(
        'Click a frame; drag to move, handles to resize; it snaps to the grid and guides, and `Alt` drags without snapping.',
      ),
      s(
        'Select several by dragging a box from the grey around the page, then align, distribute or arrange them in the inspector.',
      ),
      s(
        '"Crop" moves and zooms the photo inside its frame; "Done" or `Esc` ends it. The photo file is never changed.',
      ),
      s('Rotate & flip, Frame style, Lock in the inspector.'),
    ],
    figure: {
      step: 'editor-crop-mode',
      clip: ['[data-testid="canvas"]'],
      callouts: [{ n: 3, sel: FRAME }],
    },
    kit: ['frame-selection-handles', 'crop-in-frame'],
  },
  {
    id: 'text',
    n: 10,
    part: 3,
    toc: 'Text and captions',
    title: 'Text and captions',
    layout: 'two',
    demo: true,
    solves: 'titles, stories and dates next to your photos.',
    steps: [
      s('The Text tool in the top bar, then click on a page: a frame opens for typing.'),
      s(
        'If the text doesn\'t fit, an "Overflow" chip appears; make the frame bigger.',
      ),
      s(
        'Live text: insert date, title, caption or camera from a photo; switch "Live from photo metadata" off to freeze it.',
      ),
      s("A photo's caption: Photo inspector → Caption."),
    ],
    figure: {
      step: 'editor-text-live',
      clip: ['[data-testid="canvas"]', '[data-testid="inspector"]'],
      callouts: [],
    },
    kit: [],
  },
  {
    id: 'masters',
    n: 11,
    part: 3,
    toc: 'Masters and grids',
    title: 'Masters, layout grids, guides and page numbers',
    layout: 'two',
    demo: true,
    solves: 'change the look of many spreads at once.',
    steps: [
      s(
        '"Masters" above the spread list; edit a master\'s frames, grid and guides.',
      ),
      s('Spreads that use the master show its items in place.'),
      s(
        "To change one copy on one spread: `Ctrl/⌘` + `Shift` + click it; \"Reset to parent\" brings the master's version back.",
      ),
      s(
        'Page numbers: turn them on in the master; the numbering is in Book settings.',
      ),
      s('Grid and snap toggles sit in the top bar.'),
    ],
    figure: {
      step: 'editor-masters-mode',
      clip: ['[data-testid="canvas"]', '[data-testid="inspector"]'],
      callouts: [],
    },
    kit: [
      'parent-spreads',
      'layout-grids-settings',
      'layout-grids-render-snap',
    ],
  },
  {
    id: 'cover',
    n: 12,
    part: 3,
    toc: 'Cover and endpapers',
    title: 'Cover and endpapers',
    layout: 'two',
    demo: true,
    solves: 'a printable hardcover with the right spine, with no measuring.',
    steps: [
      s('Click Cover in the spread list.'),
      s(
        'Drop a photo on the front; type the front title, spine and back text.',
      ),
      s('The spine width follows the page count.'),
      s('Keep faces and text off the "Wrap" band: it folds around the board.'),
      s('Endpapers: a set pattern for now (other fills are coming), and "Same on back endpaper".'),
    ],
    figure: {
      step: 'editor-cover-photo-and-title',
      clip: ['[data-testid="canvas"]'],
      callouts: [],
    },
    kit: ['cover-editor'],
  },
  {
    id: 'book-settings',
    n: 13,
    part: 3,
    toc: 'Book size and printer',
    title: 'Book size and printer',
    layout: 'two',
    demo: true,
    solves: 'the book matches what your printer can make.',
    steps: [
      s('Click the book title in the top bar: Book settings.'),
      s('Orientation, size, Pages, Binding.'),
      s(
        'PRINT → Printer: a profile sets bleed and safe zone; warnings say when size or pages are outside its limits.',
      ),
      s('Settings → Print presets: the default printer and your own profiles.'),
    ],
    figure: {
      step: 'editor-inspector-book',
      clip: [888, 36, 552, 640],
      callouts: [],
    },
    kit: ['inspector', 'site-settings'],
  },
  {
    id: 'check',
    n: 14,
    part: 3,
    toc: 'Check before printing',
    title: 'Check before printing',
    layout: 'two',
    demo: true,
    solves: 'catch blurry photos and missing files before you pay for a print.',
    steps: [
      s('The "Low-res" chip in the Photos dock marks photos too small to print sharp.'),
      s('Missing photos are hatched: "Relink…" finds them in another folder.'),
      s('"Preview" shows the book as the site shows it; `Esc` returns.'),
    ],
    figure: {
      step: 'editor-missing-photos',
      clip: ['[data-testid="canvas"]', '[data-testid="demo-relink"]'],
      callouts: [{ n: 2, sel: '[data-testid="demo-relink"]' }],
    },
    kit: ['site-preview-mode'],
  },
  {
    id: 'print-shop',
    n: 15,
    part: 4,
    toc: 'Print at a shop',
    title: 'Print at a shop',
    coming: 'pdf-export',
    layout: 'two',
    demo: false,
    solves: "a print-ready PDF at the shop's size, with bleed.",
    steps: [
      s('"Print" in the top bar.'),
      s('"1 per sheet", bleed and crop marks.'),
      s('A progress bar shows while the PDF renders.'),
      s(
        '"Show in folder", then send the PDF to the shop of your printer profile.',
      ),
    ],
    figure: { step: 'print-options', clip: ['[role=dialog]'], callouts: [] },
    kit: ['pdf-export'],
  },
  {
    id: 'print-home',
    n: 16,
    part: 4,
    toc: 'Print at home and bind',
    title: 'Print at home and bind',
    coming: 'booklet-imposition',
    layout: 'wide',
    demo: false,
    solves:
      'a small book without a print shop. The app puts the pages on sheets in folding order, so after printing you only fold, nest and staple.',
    steps: [
      s(
        '"Print" → "2-up". Each sheet holds 4 pages, two per side; "4-up" holds 8 for small books.',
      ),
      s('Save the PDF and print it with the steps below.'),
    ],
    figure: {
      step: 'print-options-4up-no-bleed',
      clip: ['[role=dialog]'],
      callouts: [],
    },
    kit: ['pdf-export'],
  },
  {
    id: 'site',
    n: 17,
    part: 5,
    toc: 'Your site',
    title: 'Your site',
    layout: 'two',
    demo: true,
    solves: 'show your books online without a website builder.',
    steps: [
      s('Preview: the book as its site page.'),
      s(
        '"Export site" writes a folder you can open or upload to any web host.',
      ),
      s('Visitors open a book, turn pages, go fullscreen and share a link.'),
      s('"Publish" to your own hosting from the app.', 'in-app-publish'),
    ],
    figure: { step: 'site-book', clip: null, callouts: [] },
    kit: ['static-export', 'site-viewer', 'site-lightbox', 'in-app-publish'],
  },
  {
    id: 'settings',
    n: 18,
    part: 5,
    toc: 'Settings and shortcuts',
    title: 'Settings and shortcuts',
    layout: 'two',
    demo: true,
    solves: 'the few app-wide choices, and the keys that save time.',
    steps: [
      s(
        'Settings (gear in the top bar): library folder, cache, Print presets.',
      ),
      s('Site intro text.', 'site-settings'),
    ],
    kit: ['site-settings'],
  },
]

/** Keys handled by both the kit `#/demo` and prod. `keys` uses the Rich markup. */
export const SHORTCUTS: { keys: string; text: string }[] = [
  { keys: '`Ctrl/⌘` + `Z`', text: 'Undo' },
  { keys: '`Ctrl/⌘` + `Shift` + `Z`', text: 'Redo' },
  { keys: '`Space` + drag', text: 'Hand: pan the canvas' },
  { keys: '`Esc`', text: 'Cancel a move, end crop, close Preview' },
  { keys: '`Alt` + drag', text: 'Move without snapping' },
  { keys: '`Shift` + click', text: 'Add to the selection' },
  { keys: '`Ctrl/⌘` + `Shift` + click', text: 'Change a master item on one spread' },
  { keys: '`Delete`', text: 'Delete the selected frames' },
  { keys: '`←` `→` `↑` `↓`', text: 'Nudge (with `Shift`: a bigger step)' },
  { keys: '`Ctrl/⌘` + `=` / `-`', text: 'Zoom in / out' },
  { keys: '`Ctrl/⌘` + `0`', text: 'Fit the spread' },
  { keys: '`Shift` + `R`', text: 'Rulers' },
  { keys: '`Ctrl/⌘` + `;`', text: 'Guides' },
  { keys: "`Ctrl/⌘` + `'`", text: 'Layout grid' },
  { keys: '`Shift` + `S`', text: 'Snap' },
  { keys: '`[` `\\` `]`', text: 'Spreads panel / Photos dock / inspector' },
]

export const PAGE_COUNTS = [20, 22, 24, 32, 40]

export const ASSEMBLY: { title: string; text: string }[] = [
  {
    title: 'Print both sides',
    text: 'In the print dialog choose two-sided, *flip on short edge*. Print one sheet first to check.',
  },
  {
    title: 'Fold each sheet',
    text: 'Fold in half so page 1 is on the outside. Crease with a ruler.',
  },
  {
    title: 'Nest the sheets',
    text: 'Sheet 1 outside, the last sheet in the middle. Pages now read in order.',
  },
  {
    title: 'Staple on the fold',
    text: 'Two staples a quarter in from top and bottom, or sew three holes.',
  },
  {
    title: 'Trim the edge',
    text: 'Inner sheets stick out at the open side. Trim them flush with a ruler and blade.',
  },
]

export const PRINT_NOTES: { title: string; text: string }[] = [
  {
    title: 'Paper',
    text: 'Matte 120–170 g/m² for pages; 200–250 g/m² for the cover sheet.',
  },
  {
    title: 'Size',
    text: 'A5 book → A4 sheets; A4 or 21 × 21 cm book → A3. Home printers leave a white edge: trim it.',
  },
  {
    title: 'Thickness',
    text: 'Up to 10 sheets (40 pages) per stapled book. Thicker: make two and sew them together.',
  },
]

/** Kit feature page → the chapter that explains it. A MANIFEST slug missing here fails guide QA. */
export const CHAPTER_OF: Record<string, string> = {
  'open-save-project': 'library-folder',
  'recents-home': 'your-books',
  'spread-templates-ui': 'create-book',
  'editor-chrome-toolbar': 'editor',
  'pasteboard-workspace': 'editor',
  'editor-shell-filmstrip': 'add-photos',
  'drag-place-replace': 'place',
  'spread-list-panel': 'spreads',
  'frame-selection-handles': 'frames',
  'crop-in-frame': 'frames',
  'parent-spreads': 'masters',
  'layout-grids-settings': 'masters',
  'layout-grids-render-snap': 'masters',
  inspector: 'layouts',
  'cover-editor': 'cover',
  'site-settings': 'settings',
  'site-viewer': 'site',
  'site-lightbox': 'site',
  'site-photographer': 'site',
  'site-preview-mode': 'check',
  'pdf-export': 'print-shop',
  'static-export': 'site',
  'in-app-publish': 'site',
}

/** Kit feature pages not in prod yet → the roadmap item that ships them. That PR removes its line here. */
export const NOT_IN_APP: Record<string, string> = {
  'pdf-export': 'pdf-export',
  'in-app-publish': 'in-app-publish',
  'site-settings': 'site-settings',
}
