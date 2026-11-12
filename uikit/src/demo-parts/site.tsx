import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { templates } from "@/data"
import { BAR, SUB } from "@/sandbox/v7"
import type { SiteState } from "@/features/site-viewer"
import { PersonalSite } from "@/features/site/home"
import type { SiteStart } from "@/features/site/sys"
import type { RoomKeys } from "@/features/site-book/room"
import { blankDoc, useSession, type DBook } from "./session"
import { siteBookOf, siteBooksOf } from "./siteBooks"

const IDS = templates.map((t) => t.id)
const opts = () => ({ year: new Date().getUTCFullYear(), templates: IDS })
/** a book the editor hasn't touched yet has no doc: the editor shows the blank sample doc, so does the site */
const withDoc = (x: DBook) => (x.doc ? x : { ...x, doc: blankDoc() })
/** the site's books (D38): the session's published books; none published: the open book alone */
const useSiteBooks = (open: DBook | undefined) => {
  const all = useSession().useDemo().books
  return React.useMemo(() => {
    const pub = siteBooksOf(all.map(withDoc), opts())
    return pub.length || !open ? pub : [siteBookOf(withDoc(open), opts())]
  }, [all, open])
}
/** a kit page's `SiteState` (site-viewer / site-lightbox / site-preview-mode) → the room's start: slide s = view s + 1 */
const startOf = (book: string, s?: Partial<SiteState>): SiteStart => ({ book, view: (s?.slide ?? 0) + 1, ...(s?.lb ? { full: s.lbZoom ?? 1 } : {}) })

/** #/demo published site (personal-site K2): the bookcase of the published books, with the back-to-editor bar. A book
 *  deep link (`siteEntry=book`, or a kit page's `page: "book"`) opens that book's room. */
export function DemoSite({ id, initial }: { id: string; initial?: Partial<SiteState> }) {
  const { set, useDemo } = useSession()
  const d = useDemo()
  const books = useSiteBooks(d.books.find((x) => x.id === id))
  const deep = (initial?.page ?? d.siteEntry) === "book"
  const [start] = React.useState(() => (deep ? startOf(id, initial) : undefined))
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 bg-chrome px-3 text-sm"><Button variant="ghost" size="sm" className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" onPress={() => set({ stage: "editor", open: id })} data-testid="demo-site-back"><ChevronLeft />Back to the editor</Button><span className="text-muted-foreground" data-testid="demo-site-crumb">aleksandr.photos</span></div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0"><PersonalSite books={books} {...(start ? { start } : {})} /></div>
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

/** the page keys the Preview hands to the room (its guard stops every key before the room's window listeners) */
const PAGE_KEYS = new Set(["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"])

/** #/demo Preview (personal-site D45): the open book's reading room under a 48 px app bar, over the still-mounted editor.
 *  Back sits exactly on the editor's "‹ Library" link; All books, Share and the home hidden; Fullscreen = the lightbox.
 *  Keys: one document-capture guard — Esc closes (the lightbox's own Esc runs first and closes only it), Tab stays inside,
 *  page keys go to the room, and no key reaches the editor's window handlers. Alt+← / → stay the kit's page nav. */
export function DemoSitePreview({ id, onExit, initial }: { id: string; onExit: () => void; initial?: Partial<SiteState> }) {
  const b = useSession().useDemo().books.find((x) => x.id === id)
  const one = React.useMemo(() => (b ? [siteBookOf(withDoc(b), opts())] : []), [b])
  const [start] = React.useState(() => startOf(id, initial))
  const ref = React.useRef<HTMLDivElement>(null)
  const room = React.useRef<RoomKeys>(null)
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
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && PAGE_KEYS.has(e.key) && room.current?.key(e.key)) e.preventDefault()
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
      <div className="relative min-h-0 flex-1" data-testid="site-preview-scroll">
        <div className="absolute inset-0"><PersonalSite books={one} start={start} roomRef={room} preview /></div>
      </div>
    </div>
  )
}
