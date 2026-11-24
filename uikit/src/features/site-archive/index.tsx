/* Site demos (archive): the personal-site demos of DEMO PRs 557 (site-demo-archive) and 508 (site-stand), never merged.
   An archive, not a design source: Designer / parity take the personal site (#/feature/personal-site) and the feature
   pages, never these. Routes: #/archive (the index) · #/archive/<slug>[?books=…] (one demo, full window) ·
   #/archive?phone=<slug> (the demo framed at 390 × 844). Demo 9 (the bookcase) became the personal site, so its row
   opens main's page; the archive keeps no copy of it. */
import * as React from "react"
import { KitBar } from "@/kit/Shell"
import { href } from "@/kit/router"
import { SiteDemo1 } from "./demo-1/site"
import { SiteDemo2 } from "./demo-2/site"
import { SiteDemo3 } from "./demo-3/site"
import { SiteDemo4 } from "./demo-4/site"
import { SiteDemo5 } from "./demo-5/site"
import { SiteDemo6 } from "./demo-6/site"
import { SiteDemo7 } from "./demo-7/site"
import { SiteDemo8 } from "./demo-8/site"
import { SiteFreshA } from "./fresh-a/site"
import { SiteFreshB } from "./fresh-b/site"
import { SiteFreshC } from "./fresh-c/site"
import "./archive.css"

type Demo = { slug: string; name: string; source: string; idea: string; Demo?: () => React.ReactNode; on?: string }
export const ARCHIVE: Demo[] = [
  { slug: "site-demo-1", name: "Demo 1: the lit table", source: "awards, PR 440", idea: "Books on shelves as 3D objects; the book page is a reader that turns pages.", Demo: SiteDemo1 },
  { slug: "site-demo-2", name: "Demo 2: the night gallery", source: "awards, PR 440", idea: "A warm black room, one book per wall under its spotlight, a museum label beside it.", Demo: SiteDemo2 },
  { slug: "site-demo-3", name: "Demo 3: the index", source: "awards, PR 440", idea: "A typographic catalogue; the closed book floats after the pointer; the book turns as you scroll.", Demo: SiteDemo3 },
  { slug: "site-demo-4", name: "Demo 4: the desk", source: "awards, PR 440", idea: "Books lie top-down on a pale table in window light; drag and throw them, a click opens one.", Demo: SiteDemo4 },
  { slug: "site-demo-5", name: "Demo 5: the shelf", source: "awards, PR 440", idea: "One long shelf, the newest book face-out, the rest spine-out; hover slides one spine up.", Demo: SiteDemo5 },
  { slug: "site-demo-6", name: "Demo 6: gallery on the system", source: "stand demo 6 (v8)", idea: "A dark wall, one spotlight per book, labels under the books, on the design system.", Demo: SiteDemo6 },
  { slug: "site-demo-7", name: "Demo 7: index on the system", source: "stand demo 7 (before v4 dropped it)", idea: "A typographic list; the other rows dim on hover; a sticky preview of the book.", Demo: SiteDemo7 },
  { slug: "site-demo-8", name: "Demo 8: desk on the system", source: "awards, PR 440", idea: "Books lie flat on a light page; drag and throw them, a click opens one.", Demo: SiteDemo8 },
  { slug: "site-demo-9", name: "Demo 9: bookcase on the system", source: "stand demo 9 (v8), now the personal site", idea: "The case grows with the books; per shelf the newest book face-out, the rest spines.", on: "#/full/personal-site" },
  { slug: "site-fresh-a", name: "Fresh A: the stack", source: "fresh A, PR 474", idea: "All books in one pile; each chapter turns its book face-on and opens it as you scroll.", Demo: SiteFreshA },
  { slug: "site-fresh-b", name: "Fresh B: the row", source: "fresh B, PR 476", idea: "Books stand one behind another; pull the front one aside and it goes to the back.", Demo: SiteFreshB },
  { slug: "site-fresh-c", name: "Fresh C: the programme", source: "fresh C, PR 478 (stand reading-room version)", idea: "The site runs on the clock; each book owns a minute and turns its own pages.", Demo: SiteFreshC },
]

const LINK =
  "font-medium text-foreground underline underline-offset-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

/** the route of a demo: its archive page, or main's page for a demo that moved there */
const routeOf = (d: Demo) => d.on ?? href.archive(d.slug)

function PhoneFrame({ demo }: { demo: Demo }) {
  return (
    <div className="flex h-screen flex-col items-center gap-4 overflow-y-auto bg-muted px-6 py-6 text-foreground" data-testid="site-archive-phone">
      <div className="flex w-[390px] items-baseline justify-between gap-3 text-sm">
        <a href={href.archive()} className={LINK}>Archive</a>
        <span className="text-muted-foreground">{demo.name} · 390 × 844</span>
      </div>
      <iframe title={`${demo.name} on a phone`} src={`${location.pathname}${routeOf(demo)}`} className="box-content h-[844px] w-[390px] shrink-0 rounded-3xl border-8 border-foreground bg-background" />
    </div>
  )
}

function ArchiveIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <KitBar section="archive" />
      <main className="px-12 py-10" data-testid="site-archive">
        <h1 className="text-2xl leading-tight" style={{ fontFamily: "var(--font-heading)" }}>Site demos (archive)</h1>
        <p className="mt-2 max-w-[75ch] text-sm text-muted-foreground" data-testid="site-archive-note">
          Archive, not a design source: the personal-site demos of DEMO PRs 557 and 508, kept to look at. Designer and parity take the personal site and the feature pages, never these.
          Desktop opens the full window; Phone frames it at 390 × 844. Most take ?books=1|3|6|12.
        </p>
        <ol className="mt-8 grid max-w-[1100px] grid-cols-2 gap-x-8 gap-y-5 text-sm">
          {ARCHIVE.map((d) => (
            <li key={d.slug} className="flex flex-col gap-1" data-testid="site-archive-row" data-demo={d.slug}>
              <span className="font-medium">{d.name}</span>
              <span className="text-xs text-muted-foreground" data-testid="site-archive-source">{d.source}</span>
              <span>{d.idea}</span>
              <span className="flex gap-4">
                <a href={routeOf(d)} className={LINK} data-testid="site-archive-desktop">{d.on ? "Desktop (personal site)" : "Desktop"}</a>
                <a href={`${href.archive()}?phone=${d.slug}`} className={LINK} data-testid="site-archive-phone-link">Phone</a>
              </span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}

/** #/archive[/<slug>] */
export default function SiteArchive({ slug }: { slug?: string }) {
  if (slug) {
    const Demo = ARCHIVE.find((d) => d.slug === slug)?.Demo
    if (!Demo) return <div data-testid="not-found">No archived demo {slug}</div>
    return <div className="sa-root h-screen w-screen overflow-hidden bg-background text-foreground" data-testid="site-archive-demo" data-demo={slug}><Demo /></div>
  }
  const phone = ARCHIVE.find((d) => d.slug === /[?&]phone=([\w-]+)/.exec(location.hash)?.[1])
  return phone ? <PhoneFrame demo={phone} /> : <ArchiveIndex />
}
