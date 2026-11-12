/* Archive of every personal-site demo in its latest version (DEMO archive branch site-demo-archive, never merged).
   Desktop = the demo's full window; Phone = the same route framed at 390 × 844 (`?phone=<slug>`). */
import * as React from "react"

type Demo = { slug: string; name: string; source: string; idea: string }
export const ARCHIVE: Demo[] = [
  { slug: "site-demo-1", name: "Demo 1: the lit table", source: "awards #440", idea: "Books on shelves as 3D objects; the book page is a reader that turns pages." },
  { slug: "site-demo-2", name: "Demo 2: the night gallery", source: "awards #440", idea: "A warm black room, one book per wall under its spotlight, a museum label beside it." },
  { slug: "site-demo-3", name: "Demo 3: the index", source: "awards #440", idea: "A typographic catalogue; the closed book floats after the pointer; the book turns as you scroll." },
  { slug: "site-demo-4", name: "Demo 4: the desk", source: "awards #440", idea: "Books lie top-down on a pale table in window light; drag and throw them, a click opens one." },
  { slug: "site-demo-5", name: "Demo 5: the shelf", source: "awards #440", idea: "One long shelf, the newest book face-out, the rest spine-out; hover slides one spine up." },
  { slug: "site-demo-6", name: "Demo 6: gallery on the system", source: "stand demo 6 (v8)", idea: "A dark wall, one spotlight per book, labels under the books, on the design system." },
  { slug: "site-demo-7", name: "Demo 7: index on the system", source: "stand demo 7 (before v4 dropped it)", idea: "A typographic list; the other rows dim on hover; a sticky preview of the book." },
  { slug: "site-demo-8", name: "Demo 8: desk on the system", source: "awards #440", idea: "Books lie flat on a light page; drag and throw them, a click opens one." },
  { slug: "site-demo-9", name: "Demo 9: bookcase on the system", source: "stand demo 9 (v8)", idea: "The case grows with the books; per shelf the newest book face-out, the rest spines." },
  { slug: "site-fresh-a", name: "Fresh A: the stack", source: "fresh A #474", idea: "All books in one pile; each chapter turns its book face-on and opens it as you scroll." },
  { slug: "site-fresh-b", name: "Fresh B: the row", source: "fresh B #476", idea: "Books stand one behind another; pull the front one aside and it goes to the back." },
  { slug: "site-fresh-c", name: "Fresh C: the programme", source: "fresh C #478 (stand reading-room version)", idea: "The site runs on the clock; each book owns a minute and turns its own pages." },
]

const LINK =
  "font-medium text-foreground underline underline-offset-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]"

const phoneOf = (hash: string) => /[?&]phone=([\w-]+)/.exec(hash)?.[1]

function usePhone() {
  const [phone, setPhone] = React.useState(() => phoneOf(location.hash))
  React.useEffect(() => {
    const on = () => setPhone(phoneOf(location.hash))
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return phone
}

function PhoneFrame({ demo }: { demo: Demo }) {
  return (
    <div className="flex h-full flex-col items-center gap-4 overflow-y-auto bg-muted px-6 py-6 text-foreground" data-testid="site-archive-phone">
      <div className="flex w-[390px] items-baseline justify-between gap-3 text-sm">
        <a href="#/full/site-archive" className={LINK}>Archive</a>
        <span className="text-muted-foreground">{demo.name} · 390 × 844</span>
      </div>
      <iframe title={`${demo.name} on a phone`} src={`${location.pathname}#/full/${demo.slug}`} className="box-content h-[844px] w-[390px] shrink-0 rounded-[28px] border-8 border-foreground bg-background" />
    </div>
  )
}

export function SiteArchive() {
  const slug = usePhone()
  const phone = ARCHIVE.find((d) => d.slug === slug)
  if (phone) return <PhoneFrame demo={phone} />
  return (
    <div className="h-full overflow-y-auto bg-background px-12 py-12 text-foreground" data-testid="site-archive">
      <h1 className="text-2xl leading-tight" style={{ fontFamily: "var(--font-heading)" }}>Photographer site: demo archive</h1>
      <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
        Every personal-site demo in its latest version, {ARCHIVE.length} in all. Desktop opens the full window; Phone frames it at 390 × 844. Most take ?books=1|3|6|12.
      </p>
      <ol className="mt-8 grid max-w-[1100px] grid-cols-1 gap-x-8 gap-y-5 text-sm md:grid-cols-2">
        {ARCHIVE.map((d) => (
          <li key={d.slug} className="flex flex-col gap-1" data-testid="site-archive-row" data-demo={d.slug}>
            <span className="font-medium">{d.name}</span>
            <span className="text-xs text-muted-foreground" data-testid="site-archive-source">{d.source}</span>
            <span>{d.idea}</span>
            <span className="flex gap-4">
              <a href={`#/full/${d.slug}`} className={LINK} data-testid="site-archive-desktop">Desktop</a>
              <a href={`#/full/site-archive?phone=${d.slug}`} className={LINK} data-testid="site-archive-phone-link">Phone</a>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
