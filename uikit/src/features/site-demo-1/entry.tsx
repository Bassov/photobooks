/* Entry for the photographer-site demos (DEMO branch): five directions for the personal site, each a full-window route. */
import * as React from "react"

const DEMOS: { n: number; name: string; ready: boolean }[] = [
  { n: 1, name: "The lit table — books as 3D objects on shelves, a reader that turns rigid pages", ready: true },
  { n: 2, name: "Night gallery: one room, a horizontal wall of lit books, pages that curl like paper", ready: true },
  { n: 3, name: "Index: a typographic catalogue, the book turns as you scroll", ready: true },
  { n: 4, name: "Desk: books lying on a linen desk, pick one up, open it in the lamp light", ready: true },
  { n: 5, name: "Spines: a bookcase of spines, pull one out, riffle its pages", ready: false },
]

export function SiteDemos() {
  return (
    <div className="h-full overflow-y-auto bg-background px-12 py-12 text-foreground" data-testid="site-demos">
      <h1 className="text-2xl leading-tight" style={{ fontFamily: "var(--font-heading)" }}>Photographer site: five demos</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">Each demo opens in the full window. The ones marked coming are built next.</p>
      <ol className="mt-8 flex flex-col gap-3 text-sm">
        {DEMOS.map((d) => (
          <li key={d.n} className="flex items-baseline gap-3" data-testid="site-demo-row" data-demo={d.n}>
            <span className="w-6 tabular-nums text-muted-foreground">{d.n}</span>
            {d.ready
              ? <a href={`#/full/site-demo-${d.n}`} className="font-medium text-foreground underline underline-offset-4 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]" data-testid="site-demo-link">site-demo-{d.n}</a>
              : <span className="font-medium text-muted-foreground">site-demo-{d.n}</span>}
            <span className={d.ready ? "text-foreground" : "text-muted-foreground"}>{d.ready ? d.name : "coming"}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
