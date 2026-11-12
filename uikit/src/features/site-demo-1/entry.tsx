/* Entry for the photographer-site demo stand (DEMO branch site-stand): the demos the Owner kept, each a full-window
   route. Demo 1's data, Book3D, art and reader stay: they all use them. Fresh C left the stand (site-stand-v2 D9). */
import * as React from "react"

type Demo = { slug: string; name: string }
const DEMOS: Demo[] = [
  { slug: "site-demo-6", name: "Gallery on the system: the dark wall, one spotlight per book" },
  { slug: "site-demo-9", name: "Bookcase on the system: the case grows with the books" },
]

export function SiteDemos() {
  return (
    <div className="h-full overflow-y-auto bg-background px-12 py-12 text-foreground" data-testid="site-demos">
      <h1 className="text-2xl leading-tight" style={{ fontFamily: "var(--font-heading)" }}>Photographer site: demos</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">Each demo opens in the full window and takes ?books=1|3|6|12|30|100.</p>
      <ol className="mt-8 flex flex-col gap-3 text-sm">
        {DEMOS.map((d) => (
          <li key={d.slug} className="flex items-baseline gap-3" data-testid="site-demo-row" data-demo={d.slug}>
            <a href={`#/full/${d.slug}`} className="font-medium text-foreground underline underline-offset-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]" data-testid="site-demo-link">{d.slug}</a>
            <span className="text-foreground">{d.name}</span>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm">
        <a href="#/full/site-archive" className="font-medium text-foreground underline underline-offset-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]" data-testid="site-archive-link">All demos: the archive</a>
      </p>
    </div>
  )
}
