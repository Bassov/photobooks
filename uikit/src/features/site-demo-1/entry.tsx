/* Entry for the photographer-site demos (DEMO branch): four directions (Spec site-awards-v2) for the personal site, each a full-window route. */
import * as React from "react"

/** Spec site-awards-v2: demo 1 is off the list (its files stay: 2–5 use its data, Book3D and reader) */
const DEMOS: { n: number; name: string; ready: boolean }[] = [
  { n: 2, name: "Gallery: a dark wall of lit books, each with its museum label", ready: true },
  { n: 3, name: "Index: a typographic list, the preview changes quietly beside it", ready: true },
  { n: 4, name: "Desk: books lying on a light table, pick one up and open it", ready: true },
  { n: 5, name: "Shelf: one long shelf, the newest book face-out, the rest spine-out", ready: true },
]

export function SiteDemos() {
  return (
    <div className="h-full overflow-y-auto bg-background px-12 py-12 text-foreground" data-testid="site-demos">
      <h1 className="text-2xl leading-tight" style={{ fontFamily: "var(--font-heading)" }}>Photographer site: four demos</h1>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">Each demo opens in the full window.</p>
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
