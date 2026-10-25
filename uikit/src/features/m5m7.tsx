/* M5 Showcase site (local) + M7 Deploy as my site */
import * as React from "react"
import { ChevronLeft, ChevronRight, X, Globe, Maximize2, FolderOutput, CircleCheck, AlertTriangle, Loader2, ExternalLink, KeyRound, ShieldCheck, Upload, RefreshCw, Share2, ArrowLeft, Terminal } from "lucide-react"
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
import { makeDoc, SW, SH } from "@/sandbox/model"
import { MiniSpread, TopBar, sbtn } from "@/sandbox/chrome"
import { pagesOf } from "@/sandbox/v7"
import { P } from "@/data"
import { BOOKS } from "./screens"
import { BookObject, LibStyle } from "./library"
const serif = { fontFamily: "var(--font-heading)" } as const
import { FolderPicker } from "./screens"
import { Std, WithScenarios } from "./parts"
import type { FeatureDef } from "./types"

import { SiteViewer, spreadLabel, type SiteState } from "./site-viewer"
export { SiteViewer, spreadLabel }

const SiteDemo = ({ initial }: { initial?: Partial<SiteState> }) => <StudioProvider init={() => makeDoc()}><SiteViewer initial={initial} /></StudioProvider>

function PreviewSiteLayer() {
  const st = useStudio()
  const [on, setOn] = React.useState(false)
  return (
    <>
      <Button size="sm" variant="outline" className="absolute right-3 top-3 z-30 gap-1.5 bg-popover px-3 text-sm shadow-sm [&_svg]:size-4" onPress={() => setOn(true)} data-testid="preview-site"><Globe />Preview site</Button>
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
  const phase = p < 20 ? "Prerendering 20 pages" : p < 85 ? `Writing derivatives ${Math.round((p - 20) * 2.6)} / 168` : "Writing manifest and viewer bundle"
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-canvas p-8">
      <div className="w-[520px] rounded-xl border bg-popover p-5 shadow-md" data-testid="export">
        {s === "idle" && (<>
          <div className="flex items-center gap-3"><FeaturedIcon color="gray" theme="outline" size="md"><FolderOutput /></FeaturedIcon><div><div className="font-medium">Export site</div><div className="text-sm text-muted-foreground">Writes a static <span className="font-mono">dist/</span> you can open or upload anywhere.</div></div></div>
          <div className="mt-4 flex items-center gap-2 text-sm"><Checkbox isSelected={fail} onChange={setFail}>Simulate a write error</Checkbox></div>
          <div className="mt-4 flex justify-end"><Button size="md" onPress={() => setS("folder")} data-testid="export-start">Choose folder…</Button></div>
        </>)}
        {s === "options" && (<>
          <div className="font-medium">Export to <span className="font-mono text-sm">{folder}</span></div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {BOOKS.map((b) => <li key={b.id} className="flex items-center gap-2"><img src={P(b.cover).src} alt="" className="h-6 w-8 rounded-sm object-cover" />{b.title}<span className="ml-auto">{b.status === "published" ? <Badge color="success" dot>published</Badge> : <Badge color="gray" dot>draft · skipped</Badge>}</span></li>)}
          </ul>
          <div className="mt-3 text-xs text-muted-foreground">Only published books, from their frozen revision.</div>
          <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline" onPress={() => setS("idle")}>Back</Button><Button size="md" onPress={() => { setP(0); setS("run") }} data-testid="export-run">Export</Button></div>
        </>)}
        {s === "run" && (<>
          <div className="flex items-center gap-2 font-medium"><Loader2 className="size-4 animate-spin" />Exporting…</div>
          <Progress value={p} aria-label="Export progress" className="mt-3" barClassName="h-1.5 bg-secondary" />
          <div className="mt-2 flex text-xs tabular-nums text-muted-foreground"><span>{phase}</span><span className="ml-auto">{p}%</span></div>
          <div className="mt-1 text-xs text-muted-foreground">Runs in a worker — you can keep editing.</div>
          <div className="mt-4 flex justify-end"><Button size="md" variant="outline" onPress={() => setS("idle")}>Cancel</Button></div>
        </>)}
        {s === "done" && (<>
          <div className="flex items-center gap-3"><FeaturedIcon color="success" theme="light" size="md"><CircleCheck /></FeaturedIcon><div><div className="font-medium">Site exported</div><div className="text-sm text-muted-foreground">1 book · 168 images · 4.2 MB in {folder}/dist</div></div></div>
          <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline" onPress={() => setS("idle")}>Close</Button><Button size="md" className="gap-1.5 [&_svg]:size-4">Open index.html</Button></div>
        </>)}
        {s === "error" && (<>
          <div className="flex items-center gap-3"><FeaturedIcon color="error" theme="soft" size="md"><AlertTriangle /></FeaturedIcon><div><div className="font-medium">Export stopped</div><div className="text-sm text-muted-foreground">Could not write <span className="font-mono">img/p07-1600.webp</span>: the folder is read-only. Nothing was half-written: the previous export is intact.</div></div></div>
          <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline" onPress={() => setS("folder")}>Choose another folder</Button><Button size="md" onPress={() => { setFail(false); setP(0); setS("run") }}>Retry</Button></div>
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
        <div className="text-sm font-medium">Hard fixtures</div>
        <div className="grid grid-cols-3 gap-1.5">{[["p13", "sky"], ["p10", "foliage"], ["p05", "skin"], ["p04", "gradient"], ["p20", "texture"], ["p09", "night"]].map(([id, l]) => (
          <button key={id} type="button" onClick={() => setImg(id)} className={cn("flex flex-col gap-0.5 rounded-md p-0.5 text-2xs text-muted-foreground", img === id && "bg-accent text-foreground ring-1 ring-select")}><img src={P(id).src} alt="" className="aspect-[4/3] rounded-sm object-cover" />{l}</button>
        ))}</div>
        <SelectRow label="Preset" value={pr} onChange={(v) => setPr(v as "1600-80")} items={Object.keys(PRESETS).map((k) => [k, `${k.split("-")[0]} px · q${k.split("-")[1]}`] as [string, string])} />
        <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Format</span><Segmented label="Format" value={fmt} onChange={setFmt} items={[{ id: "jpeg", label: "JPEG" }, { id: "webp", label: "WebP" }, { id: "avif", label: "AVIF" }]} /></div>
        <div className="rounded-lg border bg-card p-3 text-sm shadow-xs" data-testid="deriv-stats">
          <div className="flex justify-between"><span className="text-muted-foreground">Size</span><b className="tabular-nums">{kb} KB</b></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Per book (≈40)</span><span className="tabular-nums">{(kb * 40 / 1024).toFixed(1)} MB</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Encode</span><span className="tabular-nums">{fmt === "avif" ? 640 : 90} ms</span></div>
        </div>
        <Button size="sm" className="text-sm">Record as default preset</Button>
      </aside>
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="relative h-[460px] w-[690px] select-none overflow-hidden rounded-md shadow-lg" data-testid="deriv-compare">
          <img src={P(img).src} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${split}%)` }}><img src={P(img).src} alt="" className="absolute inset-0 size-full object-cover" style={{ filter: `blur(${blur}px) saturate(${fmt === "jpeg" ? 0.96 : 1})` }} /></div>
          <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
          <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-2xs text-white">Original</span>
          <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-2xs text-white">{fmt.toUpperCase()} · {pr} · {kb} KB (simulated)</span>
        </div>
        <SliderRow label="Compare" resetValue={50} value={split} onChange={(v) => setSplit(v as number)} minValue={0} maxValue={100} className="absolute bottom-5 w-[300px]" />
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
        <div className="flex items-center gap-3"><FeaturedIcon color="gray" theme="outline" size="md"><KeyRound /></FeaturedIcon><div><div className="font-medium">Hosting · Cloudflare</div><div className="text-sm text-muted-foreground">Stored only on this computer, in the library settings.</div></div></div>
        <div className="mt-4 flex flex-col gap-3">
          <TextField value={acc} onChange={setAcc} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Account ID</Label><Input className="h-9 font-mono text-sm" placeholder="32-character account id" /></TextField>
          <TextField value={tok} onChange={setTok} type="password" className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">API token (scope: one bucket, write)</Label><Input className="h-9 font-mono text-sm" placeholder="paste a scoped token" /></TextField>
        </div>
        {state === "ok" && <div className="mt-3 flex items-center gap-2 rounded-lg border  bg-success/5 px-3 py-2 text-sm"><ShieldCheck className="size-4 text-success" />Connected · token can write only to <span className="font-mono">photobooks-site</span></div>}
        {state === "error" && <div className="mt-3 flex items-center gap-2 rounded-lg border  bg-destructive/5 px-3 py-2 text-sm"><AlertTriangle className="size-4 text-destructive" />Token rejected or too broad. Create a token limited to one bucket.</div>}
        <div className="mt-4 flex justify-end gap-2">
          {state === "ok" && <Button size="md" variant="destructive-ghost" onPress={() => { setTok(""); set("empty") }}>Disconnect</Button>}
          {(!acc || !tok) && <span className="mr-auto self-center text-xs text-muted-foreground" data-testid="test-reason">{!acc && !tok ? "Fill in the account and the token to test" : !acc ? "Fill in the account to test" : "Paste the token to test"}</span>}
          <Button size="md" variant="outline" isDisabled={!acc || !tok || state === "checking"} disabledReason={!acc || !tok ? (!acc && !tok ? "Fill in the account and the token to test" : !acc ? "Fill in the account to test" : "Paste the token to test") : undefined} onPress={test} className="gap-1.5 [&_svg]:size-4">{state === "checking" ? <><Loader2 className="animate-spin" />Checking…</> : "Test & save"}</Button>
        </div>
      </div>
    </div>
  )
}
function PublishBook() {
  const st = useStudio()
  return <MiniSpread s={st.doc.spreads[1] ?? st.doc.spreads[0]} width={720} className="shadow-stage" />
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
        <TopBar views={[]} publish={<Button size="sm" variant="ghost" className={cn(sbtn, "e7-sec")} style={{ background: "#D7D7D7" }} onPress={() => setS("diff")} data-testid="publish">Publish</Button>} />
        <div className="relative grid flex-1 place-items-center bg-canvas">
          <PublishBook />
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md" data-testid="publish-status"><Globe className="size-3.5" />Last published 2 days ago · <span className="font-medium text-foreground">aleksandr.photos</span></div>
          {s !== "idle" && <div className="absolute inset-0 bg-black/25" />}
          {s !== "idle" && (
            <div className="absolute w-[520px] rounded-xl border bg-popover p-5 shadow-md" data-testid="publish-dialog">
              {s === "diff" && (<>
                <div className="font-medium">Publish to aleksandr.photos</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                  {[["12", "new", "success"], ["31", "changed", "warning"], ["125", "unchanged", "gray"]].map(([n, l, c]) => <div key={l} className="rounded-lg border bg-card p-3"><div className="text-xl font-semibold tabular-nums">{n}</div><Badge color={c as "gray"} dot>{l}</Badge></div>)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Only new and changed files are uploaded (hash manifest). ≈ 6.1 MB</div>
                <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline" onPress={() => setS("idle")}>Cancel</Button><Button size="md" onPress={() => { setP(0); setFailed(false); setS("run") }}>Upload 43 files</Button></div>
              </>)}
              {(s === "run" || s === "retry") && (<>
                <div className="flex items-center gap-2 font-medium">{s === "run" ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4 text-warning" />}{s === "run" ? "Uploading…" : "Connection lost"}</div>
                <Progress value={p} aria-label="Upload progress" className="mt-3" barClassName="h-1.5 bg-secondary" />
                <div className="mt-2 text-xs tabular-nums text-muted-foreground">{Math.round(p * 0.43)} / 43 files{s === "retry" ? " · already uploaded files are kept" : ""}</div>
                <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline" onPress={() => setS("idle")}>Cancel</Button>{s === "retry" && <Button size="md" className="gap-1.5 [&_svg]:size-4" onPress={() => setS("run")}>Retry</Button>}</div>
              </>)}
              {s === "done" && (<>
                <div className="flex items-center gap-3"><FeaturedIcon color="success" theme="light" size="md"><CircleCheck /></FeaturedIcon><div><div className="font-medium">Published</div><div className="text-sm text-muted-foreground">43 files · live at aleksandr.photos</div></div></div>
                <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline" onPress={() => setS("idle")}>Close</Button><Button size="md" className="gap-1.5 [&_svg]:size-4">Open site</Button></div>
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
    notes: { what: "Fullscreen: the spread fits the window with 32 px padding on a quiet dark ground; soft side arrows, swipe, a page indicator at the bottom.", where: "Site → book page → Fullscreen (or click the spread).", why: "Look at the book without chrome.", keys: [["← →", "page"], ["Esc", "exit fullscreen"]], edge: ["First / last — the arrow fades out", "Resizing the window re-fits the book"] },
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
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm font-semibold"><Terminal className="size-4 text-muted-foreground" />Terminal</div>
        <pre className="m-4 rounded-lg bg-terminal p-4 font-mono text-sm leading-relaxed text-terminal-fg">{`$ npm run deploy -- --dir ~/Sites/photobooks/dist
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
    notes: { what: "Locally stored, narrowly scoped credentials: Account ID + a token for one bucket; test and save.", where: "Settings → Hosting.", why: "Publish from the app without a command line.", edge: ["The token is masked and goes nowhere except the Cloudflare API", "A too-broad token shows a warning", "Disconnect deletes the stored data"] },
  },
  "in-app-publish": {
    Demo: PublishFlow, h: 560,
    notes: { what: "Incremental upload by hash manifest in a worker: a new / changed / unchanged summary, progress, Retry after a dropped connection.", where: "Top bar → Publish.", why: "Update the site with one button.", edge: ["A drop at 40% (simulated) — already uploaded files are kept", "Publish again without changes — “Nothing to upload”"] },
  },
}
