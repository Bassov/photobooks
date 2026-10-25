/* v0.8 §5 — #/demo: one clickable end-to-end prototype. State lives in memory (module scope) for the session. */
import * as React from "react"
import { ChevronLeft, Settings, FolderPlus, Printer, CircleCheck, Loader2, FolderOpen, Eye, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react"
import { MenuTrigger, MenuPopover, Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { TextField, Input } from "@/components/ui/textfield"
import { Segmented, SelectRow } from "@/components/app/controls"
import { AppModal, AlertDialog, IconButton } from "@/components/app/ui"
import { photos as ALL_PHOTOS, P } from "@/data"
import { Std } from "./parts"
import { TopBar, Dock } from "@/sandbox/chrome"
import { useStudio, BOOK0, type Book } from "@/sandbox/store"
import { makeDoc, reflowDoc, SAMPLE_BOOK, type Doc } from "@/sandbox/model"
import { StudioProvider } from "@/sandbox/store"
import { PRESETS, presetLabel, useCoverPhoto, useCoverText, useMasters, getEditorExtras, setEditorExtras, defaultMasters, pagesOf, fmtN, CoverSpread, coverW, type CoverText } from "@/sandbox/v7"
import { WelcomeScreen, LibraryBar, LibraryEmpty, BookTile, LibStyle, LibSearch, LibSort, type LibBook, type SortKey } from "./library"
import { CreateBookDialog } from "./create-book"
import { FolderPicker } from "./screens"
import { SettingsScreen } from "./screen-demos"
import { SiteViewer } from "./site-viewer"
import { BOOKS } from "./screens"
type Extras = ReturnType<typeof getEditorExtras>

type Stage = "welcome" | "library" | "editor" | "settings" | "site"
type DBook = { id: string; title: string; book: Book; doc?: Doc; cover?: string; published?: boolean; extras?: Extras }
/* in-memory session store (survives leaving and re-entering #/demo until reload) */
const S: { stage: Stage; path: string; books: DBook[]; open: string | null; back: Stage; nonce: number; siteEntry: "catalog" | "book" } = { stage: "welcome", path: "", books: [], open: null, back: "library", nonce: 0, siteEntry: "catalog" }
const subs = new Set<() => void>()
let snap = { ...S }
const set = (p: Partial<typeof S>) => { Object.assign(S, p); snap = { ...S }; subs.forEach((f) => f()) }
const useDemo = () => React.useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => snap)
const firstPhoto = (d: Doc) => { for (const s of d.spreads) for (const f of s.frames) if (f.photo) return f.photo; return undefined }
/* v0.8.1 (P2-7): a new book is blank — empty frames, no photos, no sample cover text (the cover takes the book's own title) */
const blankDoc = () => makeDoc(SAMPLE_BOOK.map(([t, p]) => [t, p.map(() => null)] as [string | null, (string | null)[]]), { gallery: [] })
const blankExtras = (title: string): Extras => ({ cover: "", coverText: { front: title, spine: title, back: title } as CoverText, masters: defaultMasters() })
const coverOf = (b: DBook) => b.extras?.cover || (b.doc ? firstPhoto(b.doc) : undefined) || undefined
const fmtOf = (b: Book): LibBook["fmt"] => (b.w === b.h ? "square" : b.w > b.h ? "landscape" : "portrait")

;(window as unknown as { __demo: object }).__demo = { go: (stage: Stage) => set({ stage }), state: () => S, reset: () => set({ stage: "welcome", path: "", books: [], open: null, nonce: S.nonce + 1, siteEntry: "catalog" }), openSite: (entry: "catalog" | "book" = "catalog") => set({ stage: "site", siteEntry: entry }) }

export function DemoApp() {
  const d = useDemo()
  const [picking, setPicking] = React.useState(false)
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground" data-testid="demo" data-demo-stage={d.stage} key={d.nonce}>
      {d.stage === "welcome" && <>
        <WelcomeScreen onCreate={() => setPicking(true)} />
        <FolderPicker isOpen={picking} title="Choose where your library lives" onCancel={() => setPicking(false)} onPick={(p) => { setPicking(false); set({ stage: "library", path: p }) /* v0.8.1 (P1-4): FolderPicker already returns ~/Pictures/<folder> */ }} />
      </>}
      {d.stage === "library" && <DemoLibrary />}
      {d.stage === "editor" && d.open && <DemoEditor key={d.open} id={d.open} />}
      {d.stage === "settings" && (
        <div className="flex h-full flex-col">
          <div className="flex h-12 shrink-0 items-center gap-2 bg-chrome px-3"><Button variant="ghost" size="sm" className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" onPress={() => set({ stage: d.back })} data-testid="demo-settings-back"><ChevronLeft />{d.back === "editor" ? "Back to the book" : "Library"}</Button><span className="text-sm font-medium">Settings</span></div>
          <div className="min-h-0 flex-1"><SettingsScreen bookCount={d.books.length} libraryPath={d.path || undefined} /></div>
        </div>
      )}
      {d.stage === "site" && d.open && <DemoSite key={`${d.open}-${d.siteEntry}`} id={d.open} />}
    </div>
  )
}

/* ---------------------------------------------------------------- library */
function DemoLibrary() {
  const d = useDemo()
  const [creating, setCreating] = React.useState(false)
  const [picking, setPicking] = React.useState(false)
  const [confirmChange, setConfirmChange] = React.useState(false)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<DBook | null>(null)
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<SortKey>("edited")
  const shown = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const list = d.books.filter((b) => !q || b.title.toLocaleLowerCase().includes(q))
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === "created") return [...list].reverse()
    return list
  }, [d.books, query, sort])
  const rename = (id: string, v: string) => { set({ books: S.books.map((x) => (x.id === id ? { ...x, title: v.trim() || x.title } : x)) }); setRenaming(null) }
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-app" data-testid="home">
      <LibStyle />
      <LibraryBar path={d.path} onChange={() => setConfirmChange(true)} onSettings={() => set({ stage: "settings", back: "library" })}
        tools={d.books.length > 0 ? <><LibSearch value={query} onChange={setQuery} /><LibSort value={sort} onChange={setSort} /></> : null} />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ background: "radial-gradient(1200px 800px at 50% 30%, #D6D6D6, #C8CACB 75%)" }}>
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-12">
          <div className="flex items-end justify-between pb-2 pt-10">
            <div className="flex items-baseline gap-3"><h2 className="text-display leading-none" style={{ fontFamily: "var(--font-heading)" }}>Your books</h2>{d.books.length >= 1 && <span className="text-sm text-muted-foreground" data-testid="book-count">{d.books.length} {d.books.length === 1 ? "book" : "books"}</span>}</div>
            {d.books.length > 0 && <Button className="h-10 rounded-full px-6 text-base shadow-ink-sm" onPress={() => setCreating(true)} data-testid="new-book">Create book</Button>}
          </div>
          {d.books.length === 0 ? <LibraryEmpty onCreate={() => setCreating(true)} /> : shown.length === 0 ? (
            <div className="mt-20 text-center text-sm text-muted-foreground" data-testid="lib-no-results">No books match “{query.trim()}”. <button type="button" className="underline underline-offset-2" onClick={() => setQuery("")}>Clear search</button></div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-10 gap-y-2 pb-12" data-testid="book-grid">
              {shown.map((b) => (
                <BookTile key={b.id} b={{ id: b.id, title: b.title, src: coverOf(b) ? P(coverOf(b)!).src : undefined, fmt: fmtOf(b.book), spreads: b.doc?.spreads.length ?? 10, edited: "just now", status: b.published ? "published" : undefined }}
                  onOpen={() => set({ stage: "editor", open: b.id })}
                  title={renaming === b.id ? (
                    <TextField aria-label="Book title" defaultValue={b.title} autoFocus onKeyDown={(e) => { if (e.key === "Enter") rename(b.id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setRenaming(null) }} onBlur={(e) => rename(b.id, (e.target as HTMLInputElement).value)}>
                      <Input className="h-7 w-full px-2 text-sm" data-testid="rename-input" />
                    </TextField>
                  ) : undefined}
                  menu={
                    <MenuTrigger>
                      <IconButton label="Book actions" size="sm" tooltip={false} className="reveal-on-hover opacity-0 group-hover:opacity-100 data-[focus-visible]:opacity-100 aria-expanded:opacity-100" data-testid="book-menu"><MoreHorizontal /></IconButton>
                      <MenuPopover placement="bottom end" className="w-44">
                        <Menu className="[&_svg]:size-4 [&_svg]:text-muted-foreground" onAction={(k) => {
                          if (k === "open") set({ stage: "editor", open: b.id })
                          if (k === "rename") setRenaming(b.id)
                          if (k === "dup") set({ books: [{ ...b, id: `db${Date.now()}`, title: `${b.title} (copy)`, published: false }, ...S.books] })
                          if (k === "rm") setRemoving(b) }}>
                          <MenuItem id="open"><FolderOpen />Open</MenuItem>
                          <MenuItem id="rename"><Pencil />Rename</MenuItem><MenuItem id="dup"><Copy />Duplicate</MenuItem>
                          <MenuSeparator /><MenuItem id="rm" variant="destructive"><Trash2 />Remove…</MenuItem>
                        </Menu>
                      </MenuPopover>
                    </MenuTrigger>
                  } />
              ))}
            </div>
          )}
        </div>
      </main>
      <AlertDialog isOpen={!!removing} title={<>Remove “{removing?.title}”?</>} confirmLabel="Remove book"
        onCancel={() => setRemoving(null)} onConfirm={() => { set({ books: S.books.filter((y) => y.id !== removing!.id) }); setRemoving(null) }}>
        The book is removed from your library folder. Photos stay on disk, untouched.
      </AlertDialog>
      <AlertDialog isOpen={confirmChange} tone="neutral" icon={<FolderOpen />} title="Change the library folder?" confirmLabel="Choose folder…"
        onCancel={() => setConfirmChange(false)} onConfirm={() => { setConfirmChange(false); setPicking(true) }}>
        Photobooks works with one library at a time. Your books stay in <span className="font-mono text-sm text-foreground/80">{d.path}</span> — nothing is moved or deleted. Pick another folder to use it as the library (an empty folder starts a new one). Change it back to see these books again.
      </AlertDialog>
      <CreateBookDialog isOpen={creating} onCancel={() => setCreating(false)} onCreate={(title, book) => {
        const id = `db${Date.now()}`; setCreating(false); set({ books: [{ id, title, book }, ...S.books], open: id, stage: "editor" })
      }} />
      <FolderPicker isOpen={picking} title="Choose the library folder" onCancel={() => setPicking(false)} onPick={(p) => { setPicking(false); set({ path: p }) }} />
    </div>
  )
}

/* ---------------------------------------------------------------- editor */
function DocSpy({ id }: { id: string }) {
  const st = useStudio()
  const cov = useCoverPhoto(), ct = useCoverText(), ms = useMasters()
  React.useEffect(() => {
    const doc = reflowDoc(st.doc, st.book, BOOK0) // store in base geometry: StudioProvider reflows init docs from BOOK0
    // v0.8.1 (P1-1): the whole editor state is kept per book — doc, size, cover photo + texts, masters (incl. grids)
    set({ books: S.books.map((b) => (b.id === id ? { ...b, doc, book: st.book, extras: { cover: cov, coverText: ct, masters: ms } } : b)) })
  }, [st.doc, st.book, id, cov, ct, ms])
  return null
}
function AddFolder() {
  const st = useStudio()
  const [open, setOpen] = React.useState(false)
  return <>
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-xs [&_svg]:size-3.5" onPress={() => setOpen(true)} data-testid="demo-add-folder"><FolderPlus />Add folder…</Button>
    <FolderPicker isOpen={open} title="Add a photo folder" onCancel={() => setOpen(false)} onPick={(p) => {
      setOpen(false)
      const add = ALL_PHOTOS.map((x) => x.id).filter((x) => !st.doc.gallery.includes(x))
      st.update((d) => ({ ...d, gallery: [...d.gallery, ...add] }), `Import folder ${p}`)
      /* v0.9 §3: no floating toast for photo-folder events — quiet status only */
      st.setStatus(add.length ? `Added ${add.length} photo${add.length > 1 ? "s" : ""} from “${p}”` : `“${p}” has no new photos`)
    }} />
  </>
}
function DemoEditor({ id }: { id: string }) {
  const b = S.books.find((x) => x.id === id)!
  React.useState(() => { setEditorExtras(b.extras ?? blankExtras(b.title)); return 0 }) // restore before Std mounts (Std keep)
  const [dlg, setDlg] = React.useState<null | "publish" | "print">(null)
  const [preview, setPreview] = React.useState(false)
  const quiet = { background: "#D7D7D7" } as const
  const right = (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={() => setPreview(true)} data-testid="demo-preview"><Eye />Preview</Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={() => set({ stage: "settings", back: "editor" })} data-testid="demo-editor-settings" aria-label="Settings"><Settings /></Button>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-full px-3.5 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={() => setDlg("print")} data-testid="demo-print"><Printer />Print</Button>
      <Button variant="ghost" size="sm" className="e7-sec h-8 gap-1.5 rounded-full px-3.5 text-sm font-medium [&_svg]:size-4" style={quiet} onPress={() => setDlg("publish")} data-testid="demo-publish">Publish</Button>
    </div>
  )
  const card = { ...BOOKS[0], id: b.id, title: b.title, cover: coverOf(b) ?? "", spreads: b.doc?.spreads.length ?? 10, format: fmtOf(b.book), status: "draft" as const }
  return (
    <div className="h-full" data-testid="demo-editor">
      <Std keep init={() => b.doc ?? blankDoc()} book={b.book} cur={0} features={{ handles: true, swap: true, drop: true, multiDrop: true, crop: true, multi: true, marquee: true, textEdit: true }}
        top={<TopBar title={b.title} onLibrary={() => set({ stage: "library", open: null })} right={right} />}
        dock={<Dock right={<AddFolder />} />}
        overlay={<><DocSpy id={id} />
          {preview && <div className="fixed inset-0 z-[80]" data-testid="book-preview"><SiteViewer single onClose={() => setPreview(false)} books={[card]} initial={{ page: "book", book: b.id }} cover={(w) => <SiteCover w={w} />} /></div>}
          {dlg === "publish" && <PublishDialog title={b.title} onClose={() => setDlg(null)} />}{dlg === "print" && <PrintDialog book={b.book} spreads={b.doc?.spreads.length ?? 10} title={b.title} onClose={() => setDlg(null)} />}</>} />
    </div>
  )
}

/* ---------------------------------------------------------------- publish: options → progress → link → site */
function useRun(on: boolean, ms: number, done: () => void) {
  const [v, setV] = React.useState(0)
  React.useEffect(() => {
    if (!on) return; setV(0)
    const t0 = performance.now(); let raf = 0
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / ms); setV(Math.round(k * 100)); if (k < 1) raf = requestAnimationFrame(tick); else done() }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [on]) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book"
function PublishDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const [step, setStep] = React.useState<"opts" | "run" | "done">("opts")
  const [size, setSize] = React.useState("2048")
  const [dl, setDl] = React.useState(false)
  const v = useRun(step === "run", 1400, () => setStep("done"))
  const link = `https://aleksandr.photos/${slug(title)}`
  return (
    <AppModal isOpen width={480} onOpenChange={(o) => { if (!o && step !== "run") onClose() }} isDismissable={step !== "run"}>
      <div className="px-6 pb-5 pt-5" data-testid="publish-dialog" data-step={step}>
        {step === "opts" && <>
          <div className="heading text-xl leading-tight">Publish to your site</div>
          <p className="mt-1 text-sm text-muted-foreground">“{title}” goes to aleksandr.photos with the other published books.</p>
          <div className="mt-4 flex flex-col gap-3">
            <SelectRow label="Web image size" value={size} onChange={setSize} items={[["1600", "1600 px · smaller site"], ["2048", "2048 px · recommended"], ["3200", "3200 px · sharp on large screens"]]} />
            <Checkbox isSelected={dl} onChange={setDl}>Let visitors download a PDF</Checkbox>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Cancel</Button><Button size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => setStep("run")} data-testid="publish-go">Publish</Button></div>
        </>}
        {step === "run" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><Loader2 className="size-5 animate-spin" />Publishing…</div>
          <p className="mt-1 text-sm text-muted-foreground">{v < 50 ? "Rendering web images" : v < 90 ? "Uploading changed files" : "Finishing"} · {v}%</p>
          <Progress aria-label="Publishing" value={v} className="mt-4" barClassName="h-1.5 bg-secondary" data-testid="publish-progress" />
        </>}
        {step === "done" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><CircleCheck className="size-5" />Published</div>
          <p className="mt-1 text-sm text-muted-foreground">The book is live. Anyone with the link can see it.</p>
          <div className="mt-4 truncate rounded-md bg-field px-3 py-2 font-mono text-sm" data-testid="publish-link">{link}</div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Done</Button>
            <Button size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => { const id = S.open; set({ books: S.books.map((b) => (b.id === id ? { ...b, published: true } : b)), stage: "site", back: "editor", siteEntry: "catalog" }) }} data-testid="publish-open-site">Open site</Button></div>
        </>}
      </div>
    </AppModal>
  )
}
function DemoSite({ id }: { id: string }) {
  const d = useDemo()
  // v0.9.3: Open site / share lands on library home of published books; deep link (siteEntry=book) opens that book
  const published = d.books.filter((x) => x.published)
  const [bookId, setBookId] = React.useState(id)
  const entry = d.siteEntry ?? "catalog"
  const b = d.books.find((x) => x.id === bookId) ?? d.books.find((x) => x.id === id) ?? published[0]
  React.useLayoutEffect(() => { if (b) setEditorExtras(b.extras ?? blankExtras(b.title)) }, [b?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const cards = (published.length ? published : b ? [b] : []).map((x) => ({
    ...BOOKS[0], id: x.id, title: x.title, cover: coverOf(x) ?? "", spreads: x.doc?.spreads.length ?? 10, format: fmtOf(x.book), status: "published" as const,
  }))
  if (!b) return null
  const crumb = (d.siteEntry ?? entry) === "book" ? `aleksandr.photos/${slug(b.title)}` : "aleksandr.photos"
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 bg-chrome px-3 text-sm"><Button variant="ghost" size="sm" className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" onPress={() => set({ stage: "editor", open: id })} data-testid="demo-site-back"><ChevronLeft />Back to the editor</Button><span className="text-muted-foreground" data-testid="demo-site-crumb">{crumb}</span></div>
      <div className="min-h-0 flex-1">
        <StudioProvider key={bookId} init={() => b.doc ?? blankDoc()} book={b.book}>
          <SiteViewer
            books={cards}
            initial={{ page: entry, book: bookId }}
            cover={(w) => <SiteCover w={w} />}
            onBookSelect={(bid) => { setBookId(bid); set({ siteEntry: "book", open: bid }) }}
            onCatalog={() => set({ siteEntry: "catalog" })}
          />
        </StudioProvider>
      </div>
    </div>
  )
}

function SiteCover({ w }: { w: number }) {
  const bk = useStudio().book
  return <div style={{ width: w, height: (w * bk.h) / coverW(bk) }} data-testid="site-cover"><CoverSpread /></div>
}

/* ---------------------------------------------------------------- print: options → progress → done */
function PrintDialog({ book, spreads, title, onClose }: { book: Book; spreads: number; title: string; onClose: () => void }) {
  const [step, setStep] = React.useState<"opts" | "run" | "done">("opts")
  // v0.8.1 (P2-5): print uses the book's real size and page count
  const size = `${fmtN(book.w)} × ${fmtN(book.h)} cm`
  const known = PRESETS.find((p) => (p.w === book.w && p.h === book.h) || (p.w === book.h && p.h === book.w))
  const preset = known?.id ?? "custom"
  const [imp, setImp] = React.useState("2up")
  const [bleed, setBleed] = React.useState(true)
  const [shown, setShown] = React.useState(false)
  const v = useRun(step === "run", 1400, () => setStep("done"))
  const pages = pagesOf(spreads)
  const per = imp === "4up" ? 8 : imp === "2up" ? 4 : 1
  const sheets = Math.ceil(pages / per)
  const file = `${slug(title)}-${known ? preset : `${fmtN(book.w)}x${fmtN(book.h)}cm`}${imp !== "single" ? `-${imp}` : ""}.pdf`
  return (
    <AppModal isOpen width={500} onOpenChange={(o) => { if (!o && step !== "run") onClose() }} isDismissable={step !== "run"}>
      <div className="px-6 pb-5 pt-5" data-testid="print-dialog" data-step={step}>
        {step === "opts" && <>
          <div className="heading text-xl leading-tight">Print</div>
          <p className="mt-1 text-sm text-muted-foreground">A PDF for a print shop or a home duplex printer.</p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm" data-testid="print-size"><span className="text-muted-foreground">Page size</span><span className="tabular-nums">{known ? known.name : "Custom"} · {size}</span></div>
            <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Imposition (duplex)</span><Segmented label="Imposition" value={imp} onChange={setImp} items={[{ id: "single", label: "1 per sheet" }, { id: "2up", label: "2-up" }, { id: "4up", label: "4-up" }]} /></div>
            <Checkbox isSelected={bleed} onChange={setBleed}>Add 3 mm bleed and crop marks</Checkbox>
            <div className="text-xs text-muted-foreground" data-testid="print-summary">PDF · {pages} pages on {sheets} sheet{sheets > 1 ? "s" : ""}{imp !== "single" ? " printed both sides" : ""}{bleed ? " · bleed 3 mm" : ""}</div>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Cancel</Button><Button size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => setStep("run")} data-testid="print-go">Export PDF</Button></div>
        </>}
        {step === "run" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><Loader2 className="size-5 animate-spin" />Exporting PDF…</div>
          <p className="mt-1 text-sm text-muted-foreground">{v < 60 ? "Rendering pages at 300 dpi" : "Imposing sheets"} · {v}%</p>
          <Progress aria-label="Exporting" value={v} className="mt-4" barClassName="h-1.5 bg-secondary" data-testid="print-progress" />
        </>}
        {step === "done" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><CircleCheck className="size-5" />PDF ready</div>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="print-done">{file} · {sheets} sheets</p>
          {shown && <p className="mt-2 text-xs text-muted-foreground" role="status">Shown in ~/Documents/Photobooks exports</p>}
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => setShown(true)} data-testid="print-show"><FolderOpen />Show in folder</Button><Button size="md" className="px-4" onPress={onClose} data-testid="print-close">Done</Button></div>
        </>}
      </div>
    </AppModal>
  )
}
