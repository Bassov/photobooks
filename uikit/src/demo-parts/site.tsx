import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStudio, StudioProvider } from "@/sandbox/store"
import { setEditorExtras, CoverSpread, coverW } from "@/sandbox/v7"
import { SiteViewer, type SiteState } from "@/features/site-viewer"
import { BOOKS } from "@/features/screens"
import { useSession, blankDoc, blankExtras, coverOf, fmtOf, slug } from "./session"

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

export function SiteCover({ w }: { w: number }) {
  const bk = useStudio().book
  return <div style={{ width: w, height: (w * bk.h) / coverW(bk) }} data-testid="site-cover"><CoverSpread /></div>
}
