import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStudio, StudioProvider } from "@/sandbox/store"
import { setEditorExtras, CoverSpread, coverW, pagesOf, BAR, SUB } from "@/sandbox/v7"
import { SiteViewer, type SiteState } from "@/features/site-viewer"
import { BOOKS } from "@/features/screens"
import { useSession, blankDoc, blankExtras, coverOf, fmtOf, slug, type DBook } from "./session"

/** #/demo published site (catalog or one book), with the back-to-editor bar. State: the session (books, siteEntry). */
export function DemoSite({ id, initial }: { id: string; initial?: Partial<SiteState> }) {
  const { set, useDemo } = useSession()
  const d = useDemo()
  // v0.9.3: Open site / share lands on library home of published books; deep link (siteEntry=book) opens that book
  const published = d.books.filter((x) => x.published)
  const [bookId, setBookId] = React.useState(id)
  const entry = d.siteEntry ?? "catalog"
  const b = d.books.find((x) => x.id === bookId) ?? d.books.find((x) => x.id === id) ?? published[0]
  React.useLayoutEffect(() => { if (b) setEditorExtras(b.extras ?? blankExtras(b.title)) }, [b?.id])
  const cards = (published.length ? published : b ? [b] : []).map(cardOf)
  if (!b) return null
  const crumb = (d.siteEntry ?? entry) === "book" ? `aleksandr.photos/${slug(b.title)}` : "aleksandr.photos"
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 bg-chrome px-3 text-sm"><Button variant="ghost" size="sm" className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" onPress={() => set({ stage: "editor", open: id })} data-testid="demo-site-back"><ChevronLeft />Back to the editor</Button><span className="text-muted-foreground" data-testid="demo-site-crumb">{crumb}</span></div>
      <div className="min-h-0 flex-1">
        <StudioProvider key={bookId} init={() => b.doc ?? blankDoc()} book={b.book}>
          <SiteViewer
            books={cards}
            initial={{ page: entry, book: bookId, ...initial }}
            cover={(w) => <SiteCover w={w} />}
            onBookSelect={(bid) => { setBookId(bid); set({ siteEntry: "book", open: bid }) }}
            onCatalog={() => set({ siteEntry: "catalog" })}
          />
        </StudioProvider>
      </div>
    </div>
  )
}

/** prod src/lib/focusTrap.ts: Tab (Shift+Tab) focuses the next (previous) tabbable in `root` outside [inert], wrapping, else `root` */
function trapTab(root: HTMLElement, back: boolean) {
  const list = [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => !el.closest("[inert]"))
  const at = list.findIndex((el) => el === document.activeElement), n = list.length
  const next = (n ? list[at < 0 ? (back ? n - 1 : 0) : (at + (back ? n - 1 : 1)) % n] : undefined) ?? root
  next.focus()
}

/** #/demo Preview (Designer site-preview-mode §2 / §4 / §6): the site's book page of the open book under a 48 px app bar, over the
 *  still-mounted editor. Back sits exactly on the editor's "‹ Library" link; All books and Share hidden; Fullscreen = the site lightbox.
 *  Keys: one document-capture guard — Esc closes (the lightbox's own Esc runs first and closes only it), Tab stays inside, and no key
 *  reaches the editor's window handlers (the book page's arrows also listen on document capture). Alt+← / → stay the kit's page nav. */
export function DemoSitePreview({ id, onExit, initial }: { id: string; onExit: () => void; initial?: Partial<SiteState> }) {
  const b = useSession().useDemo().books.find((x) => x.id === id)
  const ref = React.useRef<HTMLDivElement>(null)
  const exit = React.useRef(onExit); exit.current = onExit
  const [opener] = React.useState(() => document.activeElement)
  React.useEffect(() => {
    const el = ref.current
    el?.querySelector('[data-testid="site-preview-back"]')?.setAttribute("aria-keyshortcuts", "Escape") // the kit Button drops aria-* it doesn't know
    if (el && !el.contains(document.activeElement)) el.focus() // an initially open lightbox keeps its focus
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus() }
  }, [opener])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return
      e.stopPropagation()
      if (e.defaultPrevented) return // the lightbox handled it (Tab, steps, zoom)
      if (e.key === "Escape") { e.preventDefault(); exit.current() }
      else if (e.key === "Tab") { e.preventDefault(); if (ref.current) trapTab(ref.current, e.shiftKey) }
    }
    document.addEventListener("keydown", k, true); return () => document.removeEventListener("keydown", k, true)
  }, [])
  if (!b) return null
  return (
    <div ref={ref} className="fixed inset-0 z-[80] flex flex-col outline-none" role="dialog" aria-modal="true" aria-label="Site preview" tabIndex={-1} data-testid="site-preview">
      <div className="flex h-12 shrink-0 items-center gap-2 px-3" style={{ background: BAR, boxShadow: "inset 0 -1px 0 var(--border)" }} data-testid="site-preview-bar">
        <span className="contents" title="Back to the editor (Esc)"><Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" style={{ color: SUB }} onPress={onExit} data-testid="site-preview-back"><ChevronLeft />Back to the editor</Button></span>
        <span className="text-sm" style={{ color: SUB }} data-testid="site-preview-label">Site preview</span>
      </div>
      <div className="site min-h-0 flex-1 overflow-y-auto overflow-x-hidden" data-testid="site-preview-scroll">
        <StudioProvider init={() => b.doc ?? blankDoc()} book={b.book}>
          <SiteViewer single share={false} books={[cardOf(b)]} initial={{ page: "book", book: id, slide: 0, ...initial }} cover={(w) => <SiteCover w={w} />} />
        </StudioProvider>
      </div>
    </div>
  )
}

/** a session book as a site catalog card */
const cardOf = (x: DBook) => ({ ...BOOKS[0], id: x.id, title: x.title, cover: coverOf(x) ?? "", spreads: x.doc?.spreads.length ?? 10, format: fmtOf(x.book), status: "published" as const })

export function SiteCover({ w }: { w: number }) {
  const st = useStudio(), bk = st.book
  return <div style={{ width: w, height: (w * bk.h) / coverW(bk, pagesOf(st.doc.spreads.length)) }} data-testid="site-cover"><CoverSpread /></div>
}
