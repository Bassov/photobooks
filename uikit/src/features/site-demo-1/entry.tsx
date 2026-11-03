/* Entry for the photographer-site demos (DEMO branch): five directions for the personal site, each a full-window route. */
import * as React from "react"

const DEMOS: { n: number; name: string; ready: boolean }[] = [
  { n: 1, name: "The lit table — books as 3D objects on shelves, a reader that turns rigid pages", ready: true },
  { n: 2, name: "Second direction", ready: false },
  { n: 3, name: "Third direction", ready: false },
  { n: 4, name: "Fourth direction", ready: false },
  { n: 5, name: "Fifth direction", ready: false },
]

export function SiteDemos() {
  return (
    <div className="h-full overflow-y-auto bg-background px-12 py-12 text-foreground" data-testid="site-demos">
      <h1 className="text-2xl leading-tight" style={{ fontFamily: "var(--font-heading)" }}>Photographer site: five demos</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">Each demo opens in the full window. Demos 2–5 follow from the next Designer spec.</p>
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
