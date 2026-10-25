/* v6 kit chrome: photo attribution for the library demo photos. v0.8: the welcome + empty-library photos ship in the product, so those two screens also carry it in-screen (testid "screen-credit"). */
import * as React from "react"
import { HI_CREDITS, LICENSE_URL } from "./credits"
import { photos } from "@/data"
import { href } from "./router"

const capCls = "text-2xs leading-4 text-[#535152] [&_a]:text-inherit [&_a]:no-underline [&_a:hover]:underline [&_a:hover]:underline-offset-2 [&_a]:rounded-xs [&_a]:outline-hidden [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-[#3A3839]"

/** Exactly: “Photo: Author · CC BY-SA 4.0 · modified” — author → Commons file page, license → deed. */
export function PhotoCaption({ id, testid = "photo-credit", className = "" }: { id: string; testid?: string; className?: string }) {
  const c = HI_CREDITS[id]
  if (!c) return null
  return (
    <p className={capCls + (className ? " " + className : "")} data-testid={testid} data-photo={id} title={c.title}>
      Photo: <a href={c.url} target="_blank" rel="noopener noreferrer">{c.author}</a> · <a href={LICENSE_URL[c.license]} target="_blank" rel="noopener noreferrer license">{c.license}</a> · modified
    </p>
  )
}

/** Under a demo frame: watches the demo for photos/hi/<id>.jpg and lists a caption for each one shown. */
export function DemoCredits({ frame }: { frame: React.RefObject<HTMLElement | null> }) {
  const [ids, setIds] = React.useState<string[]>([])
  React.useEffect(() => {
    const el = frame.current
    if (!el) return
    const scan = () => {
      const found = new Set<string>()
      const re = /photos\/hi\/([\w-]+)\.jpg/g
      el.querySelectorAll<HTMLElement>("[style*='photos/hi/'], img[src*='photos/hi/']").forEach((n) => {
        const s = (n.getAttribute("style") ?? "") + " " + (n.getAttribute("src") ?? "")
        for (const m of s.matchAll(re)) found.add(m[1])
      })
      const next = Object.keys(HI_CREDITS).filter((k) => found.has(k))
      setIds((cur) => (cur.join() === next.join() ? cur : next))
    }
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "src"] })
    return () => mo.disconnect()
  }, [frame])
  if (!ids.length) return null
  return (
    <div className="-mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1" data-testid="kit-photo-credits" aria-label="Photo credits for this demo">
      {ids.map((id) => <PhotoCaption key={id} id={id} />)}
      <a href="#/credits" className={capCls + " underline-offset-2 hover:underline"} data-testid="credits-link">All photo credits</a>
    </div>
  )
}

/** #/credits — the kit’s photo credits page, built from the same data as PHOTO-CREDITS.md. */
export function CreditsPage() {
  const hi = Object.values(HI_CREDITS)
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1100px] px-10 py-10" data-testid="credits-page">
        <a href={href.index} className="text-sm text-foreground underline-offset-2 hover:underline">← Index</a>
        <h1 className="heading mt-3 text-3xl">Photo credits</h1>
        <p className="mt-2 max-w-[720px] text-sm leading-relaxed text-muted-foreground">The library demo photos come from Wikimedia Commons. Adapted versions of CC BY-SA works are shared under CC BY-SA 4.0. Modifications: resized, cropped to the book format or the welcome frame, spine shading, overlaid title and subtitle, page edge and shadow; the welcome photo is faded into the background with a gradient mask. The demo screens carry no credit line; captions appear in the kit chrome under each demo and here.</p>
        <h2 className="heading mt-8 text-xl">Library demo photos</h2>
        <table className="mt-3 w-full text-left text-sm" data-testid="credits-hi">
          <thead className="text-xs text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">Used for</th><th className="py-2 pr-4 font-medium">Title</th><th className="py-2 font-medium">Credit</th></tr></thead>
          <tbody>{hi.map((c) => (
            <tr key={c.id} className="align-top">
              <td className="py-2 pr-4">{c.use}</td>
              <td className="py-2 pr-4"><a href={c.url} target="_blank" rel="noopener noreferrer" className="text-foreground underline-offset-2 hover:underline">{c.title}</a></td>
              <td className="py-2"><PhotoCaption id={c.id} /></td>
            </tr>
          ))}</tbody>
        </table>
        <h2 className="heading mt-10 text-xl">Other demo photos</h2>
        <p className="mt-2 text-sm text-muted-foreground">CC0 1.0 (public domain dedication), StockSnap.io via the Openverse API. No attribution required; listed for provenance.</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm" data-testid="credits-cc0">{photos.map((p) => <li key={p.id}><span className="font-mono text-xs text-muted-foreground">{p.id}</span> · {p.credit?.title} — {p.credit?.author}</li>)}</ul>
      </main>
    </div>
  )
}
