/* M5 Showcase site (local) + M7 Deploy as my site */
import * as React from "react"
import { ChevronLeft, ChevronRight, X, Globe, Maximize2, ZoomIn, FolderOutput, CircleCheck, AlertTriangle, Loader2, ExternalLink, KeyRound, ShieldCheck, Upload, RefreshCw, Sun, Moon, ArrowLeft, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { TextField, Input } from "@/components/ui/textfield"
import { Label } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/uui/Badge"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Segmented, SelectRow, SliderRow } from "@/components/app/controls"
import { StudioProvider, useStudio } from "@/sandbox/store"
import { makeDoc } from "@/sandbox/model"
import { MiniSpread, TopBar, sbtn } from "@/sandbox/chrome"
import { P } from "@/data"
import { BOOKS } from "./screens"
import { FolderPicker } from "./screens"
import { Std, WithScenarios } from "./parts"
import type { FeatureDef } from "./types"

/* ---------------------------------------------------------------- site viewer */
const SITE = {
  light: { bg: "#faf8f5", fg: "#1f1d1a", mute: "#77716a", card: "#ffffff", line: "#e9e4dc", acc: "#8a5a2b" },
  dark: { bg: "#151413", fg: "#efebe5", mute: "#9a948c", card: "#1f1e1c", line: "#2e2c29", acc: "#d9a46a" },
}
type SiteState = { page: "catalog" | "book"; book: string; spread: number; lb: boolean }
function SiteViewer({ title = "Aleksandr’s photobooks", books = BOOKS.filter((b, i) => i < 4 || b.status === "published"), onClose, initial }: { title?: string; books?: typeof BOOKS; onClose?: () => void; initial?: Partial<SiteState> }) {
  const st = useStudio()
  const [s, setS] = React.useState<SiteState>({ page: "catalog", book: "b1", spread: 0, lb: false, ...initial })
  const [mode, setMode] = React.useState<"light" | "dark">("light")
  const c = SITE[mode]
  const sp = st.doc.spreads
  const go = (d: number) => setS((x) => ({ ...x, spread: Math.max(0, Math.min(sp.length - 1, x.spread + d)) }))
  React.useEffect(() => {
    if (s.page !== "book") return
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); if (e.key === "Escape") setS((x) => (x.lb ? { ...x, lb: false } : x)) }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
// eslint-disable-next-line react-hooks/exhaustive-deps
  })
  const book = BOOKS.find((b) => b.id === s.book)!
  return (
    <div className="relative flex h-full flex-col overflow-auto" style={{ background: c.bg, color: c.fg }} data-testid="site">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b px-8" style={{ borderColor: c.line }}>
        <button type="button" onClick={() => setS((x) => ({ ...x, page: "catalog" }))} className="font-[Lora_Variable,serif] text-[19px]">{title}</button>
        <nav className="flex gap-4 text-[13px]" style={{ color: c.mute }}><span style={{ color: c.fg }}>Books</span><span>About</span></nav>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" aria-label="Site theme" onClick={() => setMode(mode === "light" ? "dark" : "light")} className="grid size-8 place-items-center rounded-full" style={{ background: c.card, border: `1px solid ${c.line}` }}>{mode === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}</button>
          {onClose && <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[13px] [&_svg]:size-4" onPress={onClose} data-testid="close-preview"><X />Close preview</Button>}
        </div>
      </header>
      {s.page === "catalog" ? (
        <main className="mx-auto w-full max-w-[1000px] px-8 py-10">
          <h1 className="font-[Lora_Variable,serif] text-[34px] leading-tight">Books</h1>
          <p className="mt-1 text-[14px]" style={{ color: c.mute }}>{books.length} photobooks · made with Photobooks</p>
          <div className="mt-7 grid grid-cols-3 gap-7">
            {books.map((b) => (
              <button key={b.id} type="button" onClick={() => setS({ page: "book", book: b.id, spread: 0, lb: false })} className="group text-left" data-testid="site-book">
                <div className="aspect-[4/3] overflow-hidden rounded-[3px] shadow-[0_8px_24px_rgb(0_0_0/.12)]"><img src={P(b.cover).src} srcSet={`${P(b.cover).src} 1x`} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /></div>
                <div className="mt-3 font-[Lora_Variable,serif] text-[17px]">{b.title}</div>
                <div className="text-[12.5px]" style={{ color: c.mute }}>{b.spreads} spreads · {b.edited}</div>
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col items-center px-8 py-8">
          <div className="flex w-full max-w-[1000px] items-center gap-3">
            <button type="button" onClick={() => setS((x) => ({ ...x, page: "catalog" }))} className="inline-flex items-center gap-1 text-[13px]" style={{ color: c.mute }}><ArrowLeft className="size-4" />All books</button>
            <h1 className="font-[Lora_Variable,serif] text-[24px]">{book.title}</h1>
            <span className="ml-auto text-[13px] tabular-nums" style={{ color: c.mute }}>{s.spread === 0 ? "Cover" : `Pages ${s.spread * 2}–${s.spread * 2 + 1}`} · {s.spread + 1} / {sp.length}</span>
          </div>
          <div className="relative mt-6 flex items-center gap-4">
            <button type="button" aria-label="Previous spread" disabled={s.spread === 0} onClick={() => go(-1)} className="grid size-10 place-items-center rounded-full disabled:opacity-30" style={{ background: c.card, border: `1px solid ${c.line}` }}><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={() => setS((x) => ({ ...x, lb: true }))} className="group relative cursor-zoom-in" aria-label="Open fullscreen" data-testid="site-spread">
              <MiniSpread s={sp[s.spread]} width={720} className="shadow-[0_14px_40px_rgb(0_0_0/.18)]" />
              <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"><Maximize2 className="size-4" /></span>
            </button>
            <button type="button" aria-label="Next spread" disabled={s.spread === sp.length - 1} onClick={() => go(1)} className="grid size-10 place-items-center rounded-full disabled:opacity-30" style={{ background: c.card, border: `1px solid ${c.line}` }}><ChevronRight className="size-5" /></button>
          </div>
          <div className="mt-6 flex gap-1.5">{sp.map((x, i) => <button key={x.id} type="button" aria-label={`Spread ${i + 1}`} onClick={() => setS((y) => ({ ...y, spread: i }))} className={cn("rounded-[2px] outline-offset-2", i === s.spread && "outline-2 [outline-style:solid]")} style={{ outlineColor: c.acc }}><MiniSpread s={x} width={72} /></button>)}</div>
        </main>
      )}
      {s.lb && <Lightbox i={s.spread} n={sp.length} onGo={go} onClose={() => setS((x) => ({ ...x, lb: false }))} />}
    </div>
  )
}
function Lightbox({ i, n, onGo, onClose }: { i: number; n: number; onGo: (d: number) => void; onClose: () => void }) {
  const st = useStudio()
  const [z, setZ] = React.useState<{ on: boolean; x: number; y: number }>({ on: false, x: 50, y: 50 })
  const t0 = React.useRef<number | null>(null)
  React.useEffect(() => setZ((p) => ({ ...p, on: false })), [i])
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white" data-testid="lightbox"
      onPointerDown={(e) => { t0.current = e.clientX }} onPointerUp={(e) => { if (!z.on && t0.current !== null && Math.abs(e.clientX - t0.current) > 60) onGo(e.clientX < t0.current ? 1 : -1); t0.current = null }}>
      <div className="overflow-hidden" style={{ width: 900, height: 450 }}>
        <div onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZ((p) => ({ on: !p.on, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })) }}
          className={cn("transition-transform duration-300", z.on ? "cursor-zoom-out" : "cursor-zoom-in")} style={{ transform: z.on ? "scale(2.2)" : "none", transformOrigin: `${z.x}% ${z.y}%` }}>
          <MiniSpread s={st.doc.spreads[i]} width={900} />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-4 text-[13px] text-white/70">
        <button type="button" aria-label="Previous" onClick={() => onGo(-1)} disabled={i === 0} className="grid size-9 place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
        <span className="tabular-nums">{i + 1} / {n}</span>
        <button type="button" aria-label="Next" onClick={() => onGo(1)} disabled={i === n - 1} className="grid size-9 place-items-center rounded-full bg-white/10 disabled:opacity-30"><ChevronRight className="size-4" /></button>
        <span className="ml-4 inline-flex items-center gap-1"><ZoomIn className="size-3.5" />click to zoom · swipe / ← → · Esc</span>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X className="size-4" /></button>
    </div>
  )
}
const SiteDemo = ({ initial }: { initial?: Partial<SiteState> }) => <StudioProvider init={() => makeDoc()}><SiteViewer initial={initial} /></StudioProvider>

function PreviewSiteLayer() {
  const st = useStudio()
  const [on, setOn] = React.useState(false)
  return (
    <>
      <Button size="sm" variant="outline" className="absolute right-3 top-3 z-30 h-8 gap-1.5 bg-popover px-3 text-[13px] shadow-sm [&_svg]:size-4" onPress={() => setOn(true)} data-testid="preview-site"><Globe />Preview site</Button>
      {on && <div className="fixed inset-0 z-50"><SiteViewer onClose={() => setOn(false)} initial={{ page: "book", spread: st.cur }} /></div>}
    </>
  )
}

/* ---------------------------------------------------------------- static export */
type Exp = "idle" | "folder" | "options" | "run" | "done" | "error"
function ExportFlow() {
  const [s, setS] = React.useState<Exp>("idle")
  const [folder, setFolder] = React.useState("~/Sites/photobooks")
  const [p, setP] = React.useState(0)
  const [fail, setFail] = React.useState(false)
  React.useEffect(() => {
    if (s !== "run") return
    const t = setInterval(() => setP((x) => { const n = x + 3; if (fail && n > 58) { setS("error"); return x } if (n >= 100) { setS("done"); return 100 } return n }), 90)
    return () => clearInterval(t)
  }, [s, fail])
  const phase = p < 20 ? "Prerendering 4 pages" : p < 85 ? `Writing derivatives ${Math.round((p - 20) * 2.6)} / 168` : "Writing manifest and viewer bundle"
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-canvas p-8">
      <div className="w-[520px] rounded-xl border bg-popover p-5 shadow-md" data-testid="export">
        {s === "idle" && (<>
          <div className="flex items-center gap-3"><FeaturedIcon color="gray" theme="outline" size="md"><FolderOutput /></FeaturedIcon><div><div className="font-medium">Export site</div><div className="text-[13px] text-muted-foreground">Writes a static <span className="font-mono">dist/</span> you can open or upload anywhere.</div></div></div>
          <div className="mt-4 flex items-center gap-2 text-[13px]"><Checkbox isSelected={fail} onChange={setFail}>Simulate a write error</Checkbox></div>
          <div className="mt-4 flex justify-end"><Button onPress={() => setS("folder")} data-testid="export-start">Choose folder…</Button></div>
        </>)}
        {s === "options" && (<>
          <div className="font-medium">Export to <span className="font-mono text-[13px]">{folder}</span></div>
          <ul className="mt-3 flex flex-col gap-1.5 text-[13px]">
            {BOOKS.map((b) => <li key={b.id} className="flex items-center gap-2"><img src={P(b.cover).src} alt="" className="h-6 w-8 rounded-sm object-cover" />{b.title}<span className="ml-auto">{b.status === "published" ? <Badge color="success" dot>published</Badge> : <Badge color="gray" dot>draft · skipped</Badge>}</span></li>)}
          </ul>
          <div className="mt-3 text-xs text-muted-foreground">Only published books, from their frozen revision.</div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onPress={() => setS("idle")}>Back</Button><Button onPress={() => { setP(0); setS("run") }} data-testid="export-run">Export</Button></div>
        </>)}
        {s === "run" && (<>
          <div className="flex items-center gap-2 font-medium"><Loader2 className="size-4 animate-spin" />Exporting…</div>
          <Progress value={p} aria-label="Export progress" className="mt-3" barClassName="h-1.5 bg-secondary dark:bg-accent" />
          <div className="mt-2 flex text-xs tabular-nums text-muted-foreground"><span>{phase}</span><span className="ml-auto">{p}%</span></div>
          <div className="mt-1 text-xs text-muted-foreground">Runs in a worker — you can keep editing.</div>
          <div className="mt-4 flex justify-end"><Button variant="outline" onPress={() => setS("idle")}>Cancel</Button></div>
        </>)}
        {s === "done" && (<>
          <div className="flex items-center gap-3"><FeaturedIcon color="success" theme="light" size="md"><CircleCheck /></FeaturedIcon><div><div className="font-medium">Site exported</div><div className="text-[13px] text-muted-foreground">1 book · 168 images · 4.2 MB in {folder}/dist</div></div></div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onPress={() => setS("idle")}>Done</Button><Button className="gap-1.5 [&_svg]:size-4"><ExternalLink />Open index.html</Button></div>
        </>)}
        {s === "error" && (<>
          <div className="flex items-center gap-3"><FeaturedIcon color="error" theme="soft" size="md"><AlertTriangle /></FeaturedIcon><div><div className="font-medium">Export stopped</div><div className="text-[13px] text-muted-foreground">Could not write <span className="font-mono">img/p07-1600.webp</span>: the folder is read-only. Nothing was half-written: the previous export is intact.</div></div></div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onPress={() => setS("folder")}>Choose another folder</Button><Button onPress={() => { setFail(false); setP(0); setS("run") }}>Retry</Button></div>
        </>)}
      </div>
      <FolderPicker isOpen={s === "folder"} title="Choose an export folder" onCancel={() => setS("idle")} onPick={(f) => { setFolder(f); setS("options") }} />
    </div>
  )
}

/* ---------------------------------------------------------------- derivative tuning */
const PRESETS = { "1600-80": { w: 1600, q: 80, kb: 210 }, "2400-80": { w: 2400, q: 80, kb: 420 }, "1600-60": { w: 1600, q: 60, kb: 128 }, "2400-90": { w: 2400, q: 90, kb: 690 } } as const
function DerivTuning() {
  const [img, setImg] = React.useState("p13")
  const [pr, setPr] = React.useState<keyof typeof PRESETS>("1600-80")
  const [fmt, setFmt] = React.useState("webp")
  const [split, setSplit] = React.useState(50)
  const x = PRESETS[pr]
  const kb = Math.round(x.kb * (fmt === "avif" ? 0.68 : fmt === "jpeg" ? 1.45 : 1))
  const blur = (100 - x.q) / 60 * (x.w < 2000 ? 1.2 : 0.6) * (fmt === "avif" ? 0.7 : fmt === "jpeg" ? 1.2 : 1)
  return (
    <div className="flex h-full bg-canvas">
      <aside className="flex w-[260px] shrink-0 flex-col gap-4 border-r bg-chrome p-4">
        <div className="text-[13px] font-medium">Hard fixtures</div>
        <div className="grid grid-cols-3 gap-1.5">{[["p13", "sky"], ["p10", "foliage"], ["p05", "skin"], ["p04", "gradient"], ["p20", "texture"], ["p09", "night"]].map(([id, l]) => (
          <button key={id} type="button" onClick={() => setImg(id)} className={cn("flex flex-col gap-0.5 rounded-md p-0.5 text-[10.5px] text-muted-foreground", img === id && "bg-accent text-foreground ring-1 ring-select")}><img src={P(id).src} alt="" className="aspect-[4/3] rounded-sm object-cover" />{l}</button>
        ))}</div>
        <SelectRow label="Preset" value={pr} onChange={(v) => setPr(v as "1600-80")} items={Object.keys(PRESETS).map((k) => [k, `${k.split("-")[0]} px · q${k.split("-")[1]}`] as [string, string])} />
        <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Format</span><Segmented label="Format" value={fmt} onChange={setFmt} items={[{ id: "jpeg", label: "JPEG" }, { id: "webp", label: "WebP" }, { id: "avif", label: "AVIF" }]} /></div>
        <div className="rounded-lg border bg-card p-3 text-[13px] shadow-xs" data-testid="deriv-stats">
          <div className="flex justify-between"><span className="text-muted-foreground">Size</span><b className="tabular-nums">{kb} KB</b></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Per book (≈40)</span><span className="tabular-nums">{(kb * 40 / 1024).toFixed(1)} MB</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Encode</span><span className="tabular-nums">{fmt === "avif" ? 640 : 90} ms</span></div>
        </div>
        <Button size="sm" className="h-8 text-[13px]">Record as default preset</Button>
      </aside>
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="relative h-[460px] w-[690px] select-none overflow-hidden rounded-md shadow-lg" data-testid="deriv-compare">
          <img src={P(img).src} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${split}%)` }}><img src={P(img).src} alt="" className="absolute inset-0 size-full object-cover" style={{ filter: `blur(${blur}px) saturate(${fmt === "jpeg" ? 0.96 : 1})` }} /></div>
          <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
          <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">Original</span>
          <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">{fmt.toUpperCase()} · {pr} · {kb} KB (simulated)</span>
        </div>
        <SliderRow label="Compare" value={split} onChange={(v) => setSplit(v as number)} minValue={0} maxValue={100} className="absolute bottom-5 w-[300px]" />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- M7 publish */
function Credentials() {
  return (
    <WithScenarios items={[["empty", "Empty"], ["checking", "Checking"], ["ok", "Connected"], ["error", "Error"]]} initial="empty" note="Connection states; the Test button walks through them by itself."
      render={(v, set) => <CredForm state={v} set={set} />} />
  )
}
function CredForm({ state, set }: { state: string; set: (v: string) => void }) {
  const [acc, setAcc] = React.useState(state === "empty" ? "" : "3f9c1e…a42b")
  const [tok, setTok] = React.useState(state === "empty" ? "" : "••••••••••••••••")
  const test = () => { set("checking"); setTimeout(() => set(tok.length > 8 ? "ok" : "error"), 1200) }
  return (
    <div className="grid h-full place-items-center bg-canvas p-6">
      <div className="w-[520px] rounded-xl border bg-popover p-5 shadow-md" data-testid="credentials">
        <div className="flex items-center gap-3"><FeaturedIcon color="gray" theme="outline" size="md"><KeyRound /></FeaturedIcon><div><div className="font-medium">Hosting · Cloudflare</div><div className="text-[13px] text-muted-foreground">Stored only on this computer, in the library settings.</div></div></div>
        <div className="mt-4 flex flex-col gap-3">
          <TextField value={acc} onChange={setAcc} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Account ID</Label><Input className="h-9 font-mono text-[13px]" placeholder="32-character account id" /></TextField>
          <TextField value={tok} onChange={setTok} type="password" className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">API token (scope: one bucket, write)</Label><Input className="h-9 font-mono text-[13px]" placeholder="paste a scoped token" /></TextField>
        </div>
        {state === "ok" && <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[13px]"><ShieldCheck className="size-4 text-success" />Connected · token can write only to <span className="font-mono">photobooks-site</span></div>}
        {state === "error" && <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]"><AlertTriangle className="size-4 text-destructive" />Token rejected or too broad. Create a token limited to one bucket.</div>}
        <div className="mt-4 flex justify-end gap-2">
          {state === "ok" && <Button variant="destructive-ghost" onPress={() => { setTok(""); set("empty") }}>Disconnect</Button>}
          <Button variant="outline" isDisabled={!acc || !tok || state === "checking"} onPress={test} className="gap-1.5 [&_svg]:size-4">{state === "checking" ? <><Loader2 className="animate-spin" />Checking…</> : "Test & save"}</Button>
        </div>
      </div>
    </div>
  )
}
function PublishFlow() {
  const [s, setS] = React.useState<"idle" | "diff" | "run" | "retry" | "done">("idle")
  const [p, setP] = React.useState(0)
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    if (s !== "run") return
    const t = setInterval(() => setP((x) => { if (!failed && x >= 40) { setFailed(true); setS("retry"); return x } if (x >= 100) { setS("done"); return 100 } return x + 4 }), 100)
    return () => clearInterval(t)
  }, [s, failed])
  return (
    <StudioProvider init={() => makeDoc()}>
      <div className="flex h-full flex-col">
        <TopBar views={[]} right={<Button size="sm" className={cn(sbtn, "bg-select text-white")} onPress={() => setS("diff")} data-testid="publish"><Upload />Publish</Button>} primary={false} />
        <div className="grid flex-1 place-items-center bg-canvas">
          {s === "idle" && <div className="text-center text-[13px] text-muted-foreground"><Globe className="mx-auto mb-2 size-6 opacity-60" />Last published 2 days ago · <span className="text-foreground">aleksandr.photos</span><br />Press Publish in the top bar.</div>}
          {s !== "idle" && (
            <div className="w-[520px] rounded-xl border bg-popover p-5 shadow-md" data-testid="publish-dialog">
              {s === "diff" && (<>
                <div className="font-medium">Publish to aleksandr.photos</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[13px]">
                  {[["12", "new", "success"], ["31", "changed", "warning"], ["125", "unchanged", "gray"]].map(([n, l, c]) => <div key={l} className="rounded-lg border bg-card p-2.5"><div className="text-[20px] font-semibold tabular-nums">{n}</div><Badge color={c as "gray"} dot>{l}</Badge></div>)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Only new and changed files are uploaded (hash manifest). ≈ 6.1 MB</div>
                <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onPress={() => setS("idle")}>Cancel</Button><Button onPress={() => { setP(0); setFailed(false); setS("run") }}>Upload 43 files</Button></div>
              </>)}
              {(s === "run" || s === "retry") && (<>
                <div className="flex items-center gap-2 font-medium">{s === "run" ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4 text-warning" />}{s === "run" ? "Uploading…" : "Connection lost"}</div>
                <Progress value={p} aria-label="Upload progress" className="mt-3" barClassName="h-1.5 bg-secondary dark:bg-accent" />
                <div className="mt-2 text-xs tabular-nums text-muted-foreground">{Math.round(p * 0.43)} / 43 files{s === "retry" ? " · already uploaded files are kept" : ""}</div>
                <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onPress={() => setS("idle")}>Cancel</Button>{s === "retry" && <Button className="gap-1.5 [&_svg]:size-4" onPress={() => setS("run")}><RefreshCw />Retry</Button>}</div>
              </>)}
              {s === "done" && (<>
                <div className="flex items-center gap-3"><FeaturedIcon color="success" theme="light" size="md"><CircleCheck /></FeaturedIcon><div><div className="font-medium">Published</div><div className="text-[13px] text-muted-foreground">43 files · live at aleksandr.photos</div></div></div>
                <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onPress={() => setS("idle")}>Close</Button><Button className="gap-1.5 [&_svg]:size-4"><ExternalLink />Open site</Button></div>
              </>)}
            </div>
          )}
        </div>
      </div>
    </StudioProvider>
  )
}

export const M5: Record<string, FeatureDef> = {
  "site-viewer": {
    Demo: () => <SiteDemo />,
    notes: { what: "A separate Vite entry point: book catalogue, book page, spread navigation, srcset; the site has its own palette on the same token scales (light / dark).", where: "The published site (and Preview in the editor).", why: "A showcase of books you are happy to share.", keys: [["← →", "spreads"], ["click a spread", "full screen"]], edge: ["Drafts are not shown", "Empty catalogue — “No books yet”", "Thumbnail navigation at the bottom"] },
  },
  "site-preview-mode": {
    Demo: () => <Std features={{ drop: true, swap: true }} canvasExtra={<PreviewSiteLayer />} />,
    notes: { what: "An in-app “Preview site” mode: reads the current library, no export needed; opens on the current spread.", where: "Preview site button (the Preview menu in the product).", why: "See the result before publishing.", edge: ["Change a photo in the editor and open Preview — the change is already there", "Close returns to the same place in the editor"] },
  },
  "site-lightbox": {
    Demo: () => <SiteDemo initial={{ page: "book", spread: 2, lb: true }} />,
    notes: { what: "A lightbox with CSS zoom (click zooms to the point), swipe between spreads; the pager is shared with presentation-mode.", where: "Site → book page → click a spread.", why: "Look at photo details.", keys: [["← →", "page"], ["Esc", "close"], ["click", "zoom ×2.2"]], edge: ["Swipe is disabled while zoomed", "First / last — the arrow is disabled"] },
  },
  "static-export": {
    Demo: ExportFlow, h: 560,
    notes: { what: "Pick a folder, the list of books (drafts are skipped), per-phase progress in a worker, cancel, success or an error with Retry.", where: "File → Export site.", why: "A site without the cloud: open it locally or upload it to any host.", edge: ["A write error never corrupts the previous export", "Cancel at any time", "Editing can continue meanwhile"] },
  },
  "derivative-tuning": {
    Demo: DerivTuning,
    notes: { what: "A comparison page of size / quality presets on “hard” photos (sky, foliage, skin, gradients); split view; the chosen preset is recorded.", where: "An internal dev page of the app.", why: "Balance site weight against quality.", edge: ["Quality is simulated with blur in this demo", "File size and timing are estimates"] },
  },
}

function ManualDeploy() {
  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-[13px] font-semibold dark:bg-black/15"><Terminal className="size-4 text-muted-foreground" />Terminal</div>
        <pre className="m-4 rounded-lg bg-[#151413] p-4 font-mono text-[12.5px] leading-relaxed text-[#e9e4dc]">{`$ npm run deploy -- --dir ~/Sites/photobooks/dist
✔ manifest: 168 files, 43 changed
↑ uploading 43 files … done (6.1 MB, 14 s)
✔ live at https://aleksandr.photos`}</pre>
      </div>
    </div>
  )
}

export const M7: Record<string, FeatureDef> = {
  "manual-deploy": {
    Demo: ManualDeploy, auto: true,
    notes: { what: "A documented script that uploads the exported dist/ to your own Cloudflare account; the output reports the manifest diff, upload progress and the live URL.", where: "Terminal, after File → Export site.", why: "Publishing works before an in-app Publish button exists.", edge: ["Only changed files are uploaded (hash manifest)", "Uses a token separate from CI"] },
  },
  "publish-credentials": {
    Demo: Credentials, h: 560,
    notes: { what: "Locally stored, narrowly scoped credentials: Account ID + a token for one bucket; test and save.", where: "Library settings → Hosting.", why: "Publish from the app without a command line.", edge: ["The token is masked and goes nowhere except the Cloudflare API", "A too-broad token shows a warning", "Disconnect deletes the stored data"] },
  },
  "in-app-publish": {
    Demo: PublishFlow, h: 560,
    notes: { what: "Incremental upload by hash manifest in a worker: a new / changed / unchanged summary, progress, Retry after a dropped connection.", where: "Top bar → Publish.", why: "Update the site with one button.", edge: ["A drop at 40% (simulated) — already uploaded files are kept", "Publish again without changes — “Nothing to upload”"] },
  },
}
