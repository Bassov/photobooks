/* M6 Print + M8 For others */
import { pagesName } from "@/sandbox/v7"
import * as React from "react"
import { AlertTriangle, AlertCircle, Info, ArrowRight, FileDown, Loader2, CircleCheck, Printer, BookOpen, Wand2, Image as ImageIcon, FileText, Plus, Sparkles, Globe, KeyRound, ShieldCheck, Check, HardDrive, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { TextField, Input, TextArea } from "@/components/ui/textfield"
import { Label } from "@/components/ui/field"
import { Badge } from "@/components/uui/Badge"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Section } from "@/components/app/ui"
import { Segmented, SelectRow, SliderRow } from "@/components/app/controls"
import { StudioProvider, useStudio, mapFrames } from "@/sandbox/store"
import { makeDoc, textFrame, effectiveDpi, PAGE, SW, SH, type Doc } from "@/sandbox/model"
import { TopBar, PanelHeader, MiniSpread, DialogBackdrop } from "@/sandbox/chrome"
import { InspectorPanel, PhotoSection, CropSection, EmptyInspector, useSelected, MmField } from "@/sandbox/inspector"
import { P } from "@/data"
import { BOOKS, FolderPicker } from "./screens"
import { WelcomeScreen, HomeScreen, BookObject, LibStyle } from "./library"
import { Std, Dev, SpecCard, WithScenarios } from "./parts"
import type { FeatureDef } from "./types"

/* ---------------------------------------------------------------- print sample + preflight */
const printDoc = (): Doc => {
  const d = makeDoc()
  d.spreads[2] = { ...d.spreads[2], frames: d.spreads[2].frames.map((f, i) => (i === 0 ? { ...f, photo: "p02" } : i === 1 ? { ...f, zoom: 2.6 } : f)) }
  d.spreads[3] = { ...d.spreads[3], frames: [...d.spreads[3].frames, textFrame({ x: 203, y: 186, w: 60, h: 10, text: "Too close to the edge", textStyle: "caption" })] }
  d.spreads[1] = { ...d.spreads[1], frames: d.spreads[1].frames.map((f) => ({ ...f, x: 1.5, y: 1.5, w: SW - 3, h: SH - 3 })) }
  return d
}
type Issue = { id: string; sev: "error" | "warning" | "info"; si: number; fid?: string; msg: string; fix?: { label: string; run: () => void } }
function useIssues(): Issue[] {
  const st = useStudio()
  const out: Issue[] = []
  st.doc.spreads.forEach((s, si) => s.frames.forEach((f) => {
    if (f.kind === "image") {
      if (f.photo && st.missing.has(f.photo)) out.push({ id: `m${f.id}`, sev: "error", si, fid: f.id, msg: `${P(f.photo).name} is missing`, fix: { label: "Relink", run: () => { const n = new Set(st.missing); n.delete(f.photo!); st.setMissing(n); st.toast({ tone: "success", title: "Relinked", description: `Found ${P(f.photo!).name} in ~/Photos/Summer` }, 2500) } } })
      else if (!f.photo) out.push({ id: `e${f.id}`, sev: "warning", si, fid: f.id, msg: "Empty frame — prints as blank paper" })
      const dpi = effectiveDpi(f)
      if (dpi !== null && dpi < 200 && !(f.photo && st.missing.has(f.photo))) out.push({ id: `d${f.id}`, sev: dpi < 150 ? "error" : "warning", si, fid: f.id, msg: `${P(f.photo!).name}: ${dpi} dpi (min 150, warn 200)`, fix: f.zoom > 1 ? { label: "Reset crop to cover", run: () => st.update((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, zoom: 1, ox: 0, oy: 0 })), "Reset crop") } : undefined })
      const near = (v: number, edge: number) => v !== edge && Math.abs(v - edge) < 3
      if (near(f.x, 0) || near(f.y, 0) || near(f.x + f.w, SW) || near(f.y + f.h, SH)) out.push({ id: `b${f.id}`, sev: "warning", si, fid: f.id, msg: "Photo stops just short of the trim — a white sliver may show", fix: { label: "Extend to bleed", run: () => st.update((d) => mapFrames(d, si, [f.id], (x) => { const l = x.x < 3 ? -3 : x.x, t = x.y < 3 ? -3 : x.y, r = x.x + x.w > SW - 3 ? SW + 3 : x.x + x.w, b = x.y + x.h > SH - 3 ? SH + 3 : x.y + x.h; return { ...x, x: l, y: t, w: r - l, h: b - t } }), "Extend to bleed") } })
    } else if (f.y + f.h > SH - 6 || f.x < 6 || f.x + f.w > SW - 6 || (f.x < PAGE + 6 && f.x + f.w > PAGE - 6)) out.push({ id: `t${f.id}`, sev: "warning", si, fid: f.id, msg: "Text outside the safe area (6 mm)", fix: { label: "Move inside", run: () => st.update((d) => mapFrames(d, si, [f.id], (x) => ({ ...x, x: Math.max(PAGE + 8, x.x), y: Math.min(SH - 8 - x.h, x.y) })), "Move text inside safe area") } })
  }))
  if (st.doc.spreads.length % 2 === 1) out.push({ id: "pc", sev: "info", si: 0, msg: `${st.doc.spreads.length * 2} pages — the profile needs a multiple of 4; 2 blank pages will be added` })
  return out
}
const SEV = { error: [AlertCircle, "text-destructive", "Errors"], warning: [AlertTriangle, "text-warning-fg", "Warnings"], info: [Info, "text-muted-foreground", "Info"] } as const
function PrintTopBar() { const n = useIssues().filter((i) => i.sev === "error").length; return <TopBar views={["overlays", "dpi", "snap"]} printErrors={n} /> }
function PreflightPanel({ fixes = false }: { fixes?: boolean }) {
  const st = useStudio()
  const issues = useIssues()
  const jump = (i: Issue) => { st.setCur(i.si); if (i.fid) st.setSel([i.fid]); st.setStatus(`${pagesName(i.si)}: ${i.msg}`) }
  const nErr = issues.filter((i) => i.sev === "error").length
  const exportReason = `Fix ${nErr} error${nErr === 1 ? "" : "s"} to export`
  return (
    <aside className="flex min-h-0 flex-col border-l bg-chrome" data-testid="preflight">
      <PanelHeader icon={<Printer />} title="Preflight" meta={<span className="flex items-center gap-1.5"><span className="text-destructive">{issues.filter((i) => i.sev === "error").length}</span>·<span className="text-warning-fg">{issues.filter((i) => i.sev === "warning").length}</span></span>} />
      <div className="border-b px-3 py-2 text-xs text-muted-foreground">Profile: <b className="text-foreground">Saal Digital · 28×28 layflat</b></div>
      <div className="min-h-0 flex-1 overflow-auto">
        {issues.length === 0 && <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm"><CircleCheck className="size-6 text-success" />Ready to print. No problems found.</div>}
        {(["error", "warning", "info"] as const).map((sev) => {
          const list = issues.filter((i) => i.sev === sev); if (!list.length) return null
          const [I, c, t] = SEV[sev]
  return (
            <div key={sev} className="border-b py-1">
              <div className={cn("flex items-center gap-1.5 px-3 py-2 text-2xs font-semibold uppercase tracking-wide", c)}><I className="size-3.5" />{t} · {list.length}</div>
              {list.map((i) => (
                <div key={i.id} className="group flex flex-col gap-1 px-3 py-2 hover:bg-accent/50">
                  <button type="button" onClick={() => jump(i)} className="flex items-start gap-2 text-left text-sm"><span className="mt-0.5 shrink-0 rounded bg-muted px-1 text-2xs tabular-nums text-muted-foreground">{i.si + 1}</span><span className="min-w-0 flex-1">{i.msg}</span><ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" /></button>
                  {fixes && i.fix && <Button size="xs" variant="outline" className="ml-6 self-start gap-1 px-2 text-xs shadow-xs [&_svg]:size-3" onPress={() => { i.fix!.run(); st.setCur(i.si) }} data-testid="fix"><Wand2 />{i.fix.label}</Button>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <div className="border-t p-3"><Button size="sm" variant="outline" className="w-full gap-1.5 text-sm [&_svg]:size-4" isDisabled={nErr > 0} disabledReason={exportReason} data-testid="export-print-pdf"><FileDown />Export print PDF</Button>{nErr > 0 && <div className="mt-2 text-center text-xs text-muted-foreground" data-testid="export-reason">{exportReason} · the same rule applies in Export → Print PDF</div>}</div>
    </aside>
  )
}

/* ---------------------------------------------------------------- export dialogs */
function ExportDialog({ kind }: { kind: "pdf" | "jpeg" }) {
  const [s, setS] = React.useState<"opts" | "run" | "done">("opts")
  const [p, setP] = React.useState(0)
  const [out, setOut] = React.useState("pages")
  React.useEffect(() => { if (s !== "run") return; const t = setInterval(() => setP((x) => { if (x >= 100) { setS("done"); return 100 } return x + 2 }), 70); return () => clearInterval(t) }, [s])
  return (
    <StudioProvider init={printDoc}>
      <div className="relative grid h-full place-items-center bg-canvas">
        <DialogBackdrop />
        <div className="relative w-[560px] rounded-xl border bg-popover p-5 shadow-lg" data-testid={`${kind}-export`}>
          <div className="flex items-center gap-3"><FeaturedIcon color="gray" theme="outline" size="md">{kind === "pdf" ? <FileText /> : <ImageIcon />}</FeaturedIcon><div><div className="font-medium">{kind === "pdf" ? "Export print PDF" : "Export JPEG spreads"}</div><div className="text-sm text-muted-foreground">Summer by the sea · 8 spreads · Saal Digital 28×28</div></div></div>
          {s === "opts" && (<>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {kind === "pdf" ? <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Output</span><Segmented label="Output" value={out} onChange={setOut} items={[{ id: "pages", label: "Pages" }, { id: "spreads", label: "Spreads" }]} /></div>
                : <SelectRow label="Resolution" defaultValue="300" items={[["300", "300 dpi · 6614×3307 px"], ["200", "200 dpi"]]} />}
              <SelectRow label="Profile" defaultValue="saal" items={[["saal", "Saal Digital 28×28"], ["blurb", "Blurb 10×8"], ["home", "Home printer A4"]]} />
            </div>
            <div className="mt-3 flex gap-1.5 overflow-hidden">{makeDoc().spreads.slice(0, 6).map((x) => <MiniSpread key={x.id} s={x} width={80} />)}</div>
            <div className="mt-3 text-xs text-muted-foreground">{kind === "pdf" ? "Original JPEG bytes, ICC profiles kept · bleed 3 mm · captions with embedded fonts" : "One sRGB JPEG per spread at profile size"}</div>
            <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline">Cancel</Button><Button size="md" onPress={() => { setP(0); setS("run") }} data-testid="run-export">Export</Button></div>
          </>)}
          {s === "run" && (<>
            <Progress value={p} aria-label="Export" className="mt-4" barClassName="h-1.5 bg-secondary" />
            <div className="mt-2 flex text-xs tabular-nums text-muted-foreground"><Loader2 className="mr-1.5 size-3.5 animate-spin" />{kind === "pdf" ? `Painting page ${Math.ceil(p / 6.25)} of 16 in a worker` : `Encoding spread ${Math.ceil(p / 12.5)} of 8`}<span className="ml-auto">peak memory {Math.round(180 + p * 1.2)} MB</span></div>
            <div className="mt-4 flex justify-end"><Button size="md" variant="outline" onPress={() => setS("opts")}>Cancel</Button></div>
          </>)}
          {s === "done" && (<>
            <div className="mt-4 flex items-center gap-2 rounded-lg border  bg-success/5 px-3 py-2 text-sm"><CircleCheck className="size-4 text-success" />{kind === "pdf" ? "summer-by-the-sea.pdf · 20 pages · 228 MB" : "10 JPEG files · 80 MB"}</div>
            <div className="mt-4 flex justify-end gap-2"><Button size="md" variant="outline" onPress={() => setS("opts")}>Close</Button><Button size="md" className="gap-1.5 [&_svg]:size-4">Download</Button></div>
          </>)}
        </div>
      </div>
    </StudioProvider>
  )
}

/* ---------------------------------------------------------------- booklet + cover */
function Booklet() {
  const [n, setN] = React.useState(14)
  const pages = Math.ceil(n / 4) * 4
  const sheets = pages / 4
  const order: [number, number, number, number][] = []
  for (let s = 0; s < sheets; s++) order.push([pages - 2 * s, 1 + 2 * s, 2 + 2 * s, pages - 1 - 2 * s])
  const lab = (x: number) => (x > n ? "·" : String(x))
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-canvas p-6">
      <div className="flex items-end gap-6">
        <SliderRow label="Pages in the book" resetValue={14} value={n} onChange={(v) => setN(v as number)} minValue={4} maxValue={32} className="w-72" />
        <div className="text-sm"><b>{sheets}</b> sheets · {pages - n} blank page{pages - n === 1 ? "" : "s"} added · saddle stitch</div>
        <Button size="sm" className="ml-auto gap-1.5 text-sm [&_svg]:size-4">Export imposed PDF</Button>
      </div>
      <div className="grid grid-cols-4 gap-4" data-testid="booklet">
        {order.map(([a, b, c, d], i) => (
          <div key={i} className="rounded-lg border bg-card p-3 shadow-xs">
            <div className="mb-2 text-2xs text-muted-foreground">Sheet {i + 1}</div>
            {[[a, b, "front"], [c, d, "back"]].map(([l, r, side]) => (
              <div key={String(side)} className="mb-2 flex items-center gap-1.5"><div className="flex flex-1 overflow-hidden rounded-2xs shadow-hairline">{[l, r].map((x, j) => <div key={j} className={cn("grid h-12 flex-1 place-items-center text-base font-semibold tabular-nums", (x as number) > n ? "bg-muted text-muted-foreground" : "bg-white text-ink", j === 0 && "border-r")}>{lab(x as number)}</div>)}</div><span className="w-8 text-2xs text-muted-foreground">{side as string}</span></div>
            ))}
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-3 text-sm leading-relaxed text-muted-foreground"><b className="text-foreground">Duplex:</b> print on both sides, flip on the short edge; fold the stack in half and staple at the fold.</div>
    </div>
  )
}
function CoverEditor() {
  const [pages, setPages] = React.useState(40)
  const [paper, setPaper] = React.useState("170")
  const spine = Math.round(pages * (paper === "170" ? 0.18 : 0.12) * 10) / 10 + 2
  const sc = 1.55, W = 200, H = 200, wrap = 15, hinge = 8
  const tot = W * 2 + spine
  return (
    <StudioProvider init={() => makeDoc()}>
      <div className="flex h-full">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-canvas p-6">
          <div className="relative" style={{ width: (tot + wrap * 2) * sc * 0.82, height: (H + wrap * 2) * sc * 0.82 }} data-testid="cover">
            <div className="absolute inset-0 rounded-sm bg-placeholder-block" />
            <div className="absolute overflow-hidden bg-white shadow-md" style={{ left: wrap * sc * 0.82, top: wrap * sc * 0.82, width: tot * sc * 0.82, height: H * sc * 0.82 }}>
              <img src={P("p16").src} alt="" className="absolute right-0 top-0 h-full object-cover" style={{ width: W * sc * 0.82 }} />
              <div className="absolute left-0 top-0 flex h-full flex-col justify-end p-4 text-2xs text-ink-muted" style={{ width: W * sc * 0.82 }}><img src={P("p13").src} alt="" className="mb-3 h-24 w-full object-cover" />Back cover · ISBN / barcode zone</div>
              <div className="absolute top-0 flex h-full items-center justify-center bg-ink text-white" style={{ left: W * sc * 0.82, width: spine * sc * 0.82 }}><span className="whitespace-nowrap font-[Lora_Variable,serif] text-2xs [writing-mode:vertical-rl]">Summer by the sea</span></div>
              {[W, W + spine].map((x, i) => <div key={i} data-allow-border="print guide" className="absolute inset-y-0 border-l border-dashed border-bleed" style={{ left: (x + (i ? hinge : -hinge)) * sc * 0.82 }} />)}
              <div className="absolute bottom-6 font-[Lora_Variable,serif] text-xl text-white drop-shadow" style={{ left: (W + spine + 12) * sc * 0.82 }}>Summer by the sea</div>
            </div>
            <span className="absolute -top-5 left-0 text-2xs text-muted-foreground">wrap {wrap} mm</span>
            <span className="absolute -bottom-5 text-2xs font-medium text-bleed-fg" style={{ left: (wrap + W - 10) * sc * 0.82 }}>hinge · spine {spine} mm</span>
          </div>
          <div className="mt-4 flex gap-6 text-2xs text-muted-foreground"><span>BACK</span><span>SPINE</span><span>FRONT</span></div>
        </div>
        <aside className="w-[264px] shrink-0 border-l bg-chrome">
          <Section title="Cover"><div className="flex flex-col gap-3">
            <SliderRow label="Pages" resetValue={40} value={pages} onChange={(v) => setPages(v as number)} minValue={20} maxValue={120} step={4} />
            <SelectRow label="Paper" value={paper} onChange={setPaper} items={[["170", "Matte 170 g · 0.18 mm/page"], ["120", "Silk 120 g · 0.12 mm/page"]]} />
            <div className="rounded-md border bg-card p-3 text-sm tabular-nums">Spine: <b>{spine} mm</b> (formula from the profile)<br />Total: {Math.round(tot + wrap * 2)} × {H + wrap * 2} mm</div>
          </div></Section>
        </aside>
      </div>
    </StudioProvider>
  )
}

/* ---------------------------------------------------------------- M8 */
function Onboarding() {
  return <WithScenarios items={[["welcome", "Welcome"], ["ready", "Library ready"]]} initial="welcome" render={(v, set) => (
    <div className="h-full" data-testid="onboarding">{v === "welcome" ? <FirstRunFlow onDone={() => set("ready")} /> : <HomeScreen empty />}</div>
  )} />
}
function FirstRunFlow({ onDone }: { onDone: () => void }) {
  const [picking, setPicking] = React.useState(false)
  return <><WelcomeScreen onCreate={() => setPicking(true)} /><FolderPicker isOpen={picking} title="Choose where your library lives" onCancel={() => setPicking(false)} onPick={() => { setPicking(false); onDone() }} /></>
}
function ConnectHosting() {
  const [step, setStep] = React.useState(0)
  const steps = ["Create a Cloudflare account", "Create a scoped token", "Paste and verify", "Choose a domain"]
  return (
    <div className="flex h-full bg-canvas">
      <aside className="w-[240px] shrink-0 border-r bg-chrome p-4">
        <div className="mb-3 text-sm font-medium">Connect your hosting</div>
        <ol className="flex flex-col gap-1">{steps.map((s, i) => <li key={s}><button type="button" onClick={() => setStep(i)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm", i === step ? "bg-accent font-medium" : "text-muted-foreground")}><span className={cn("grid size-5 place-items-center rounded-full border text-2xs", i < step && " bg-success text-white")}>{i < step ? <Check className="size-3" /> : i + 1}</span>{s}</button></li>)}</ol>
      </aside>
      <div className="grid flex-1 place-items-center p-6">
        <div className="w-[480px] rounded-xl border bg-popover p-5 shadow-md" data-testid="connect-hosting">
          <div className="text-2xs text-muted-foreground">Step {step + 1} of 4</div>
          <div className="mt-1 font-medium">{steps[step]}</div>
          <div className="mt-2 text-sm text-muted-foreground">{[
            "Free plan is enough. We never see your password.",
            "Open the prepared link — the token is limited to one R2 bucket and nothing else.",
            "Paste the token. It is stored only on this computer.",
            "Use the free *.pages address or connect your own domain.",
          ][step]}</div>
          {step === 1 && <Button size="md" variant="outline" className="mt-3 gap-1.5 [&_svg]:size-4"><KeyRound />Open token page</Button>}
          {step === 2 && <TextField className="mt-3" aria-label="Token"><Input type="password" placeholder="paste token" className="h-9 font-mono text-sm" /></TextField>}
          {step === 3 && <div className="mt-3 flex items-center gap-2 rounded-lg border  bg-success/5 px-3 py-2 text-sm"><ShieldCheck className="size-4 text-success" />aleksandr.photos · DNS verified</div>}
          <div className="mt-5 flex justify-between"><Button size="md" variant="ghost" isDisabled={step === 0} onPress={() => setStep(step - 1)}>Back</Button><Button size="md" onPress={() => setStep(Math.min(3, step + 1))}>{step === 3 ? "Finish" : "Continue"}</Button></div>
        </div>
      </div>
    </div>
  )
}
function SiteSettings() {
  const [t, setT] = React.useState("Aleksandr’s photobooks")
  const [a, setA] = React.useState("Aleksandr Basov")
  const [about, setAbout] = React.useState("Trips, family and the sea. Printed and online.")
  return (
    <div className="flex h-full">
      <aside className="flex w-[300px] shrink-0 flex-col gap-3 bg-chrome p-4" data-testid="site-settings">
        <div className="text-sm font-medium">Site settings</div>
        <TextField value={t} onChange={setT} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Site title</Label><Input className="h-8 text-sm" /></TextField>
        <TextField value={a} onChange={setA} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Author</Label><Input className="h-8 text-sm" /></TextField>
        <TextField value={about} onChange={setAbout} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">About page</Label><TextArea className="min-h-20 text-sm" /></TextField>
        <p className="text-xs text-muted-foreground">The site uses the library look: light grey paper, serif titles, books as objects.</p>
      </aside>
      <div className="flex-1 overflow-hidden bg-background p-8 text-foreground" data-testid="site-preview">
        <LibStyle />
        <div className="text-xl" style={{ fontFamily: "var(--font-heading)" }}>{t || "Untitled site"}</div>
        <div className="text-sm text-muted-foreground">by {a || "—"}</div>
        <div className="mt-6 grid grid-cols-3 items-end gap-6">{BOOKS.slice(0, 3).map((b) => <div key={b.id} className="flex flex-col items-center gap-2"><BookObject src={P(b.cover).src} title={b.title} fmt={b.format ?? "portrait"} h={130} /><div className="text-center text-base" style={{ fontFamily: "var(--font-heading)" }}>{b.title}</div></div>)}</div>
        <div className="mt-6 max-w-[420px] text-sm leading-relaxed text-muted-foreground"><b className="text-foreground">About.</b> {about}</div>
      </div>
    </div>
  )
}
function PrinterPresets() {
  const [sel, setSel] = React.useState("saal")
  const list = [["saal", "Saal Digital", "28×28 layflat", "EU"], ["blurb", "Blurb", "10×8 landscape", "US"], ["cewe", "CEWE", "A4 landscape", "EU"], ["home", "Home printer", "A4 booklet", "—"], ["custom", "Custom profile", "your values", ""]]
  return (
    <div className="flex h-full bg-canvas" data-testid="printer-presets">
      <aside className="w-[280px] shrink-0 border-r bg-chrome p-2">
        {list.map(([id, n, d, r]) => <button key={id} type="button" onClick={() => setSel(id)} className={cn("flex w-full items-center gap-2 rounded-lg p-2 text-left", sel === id ? "bg-accent" : "hover:bg-accent/50")}>{id === "custom" ? <Plus className="size-4 text-muted-foreground" /> : <Printer className="size-4 text-muted-foreground" />}<span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n}</span><span className="block text-xs text-muted-foreground">{d}</span></span>{r && <Badge color="gray">{r}</Badge>}</button>)}
      </aside>
      <div className="flex-1 p-6">
        <div className="max-w-[480px] rounded-xl border bg-popover p-5 shadow-xs">
          <div className="font-medium">{list.find((l) => l[0] === sel)![1]}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MmField label="Trim width" value={sel === "blurb" ? 254 : 280} onChange={() => { }} isDisabled={sel !== "custom"} />
            <MmField label="Trim height" value={sel === "blurb" ? 203 : 280} onChange={() => { }} isDisabled={sel !== "custom"} />
            <MmField label="Page bleed" value={3} onChange={() => { }} isDisabled={sel !== "custom"} />
            <MmField label="Cover bleed" value={15} onChange={() => { }} isDisabled={sel !== "custom"} />
            <MmField label="Safe margin" value={6} onChange={() => { }} isDisabled={sel !== "custom"} />
            <MmField label="Min DPI" unit="dpi" value={150} onChange={() => { }} isDisabled={sel !== "custom"} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Page count: multiple of {sel === "home" ? 4 : 2}, 20–200 · spine: formula 0.18 mm/page</div>
          {sel !== "custom" && <Button variant="outline" size="md" className="mt-3">Duplicate as custom</Button>}
        </div>
      </div>
    </div>
  )
}
function DpiTab() { const { f } = useSelected(); return f ? <><PhotoSection /><CropSection /></> : <EmptyInspector hint="Select a frame — frames under 300 dpi show an orange badge." /> }

function PdfCaptions() {
  return (
    <Dev>
      <div className="grid grid-cols-2 gap-4">{["Editor (DOM)", "PDF"].map((t) => <SpecCard key={t} title={t}><div className="rounded bg-white p-4 text-ink"><img src={P("p13").src} alt="" className="h-40 w-full object-cover" /><div className="mt-2 font-[Inter_Variable] text-xs">Morning swim before breakfast · Jul 14</div></div></SpecCard>)}</div>
    </Dev>
  )
}
function PrintReport() {
  return (
    <Dev>
      <SpecCard title="summer-by-the-sea.report.txt"><pre className="font-mono text-sm leading-relaxed">{`Profile      Saal Digital · 28×28 layflat
Trim         280 × 280 mm   Bleed 3 mm
Pages        16 (+2 blank)  Spine 5.2 mm
Lowest DPI   212 (spread 3, IMG_4155)
Warnings     2   Errors 0
Files        book.pdf · cover.pdf`}</pre></SpecCard>
    </Dev>
  )
}
function CoverPdf() {
  return (
    <Dev>
      <SpecCard title="cover.pdf"><div className="flex items-center gap-1"><div className="h-40 w-56 bg-cover" style={{ backgroundImage: `url(${P("p13").src})` }} /><div className="h-40 w-5 bg-ink" /><div className="h-40 w-56 bg-cover" style={{ backgroundImage: `url(${P("p16").src})` }} /></div><div className="mt-2 text-xs text-muted-foreground">430.2 × 310 mm · cover bleed 15 mm · spine 5.2 mm</div></SpecCard>
    </Dev>
  )
}

export const M6: Record<string, FeatureDef> = {
  "dpi-badge": {
    Demo: () => <Std init={printDoc} view={{ dpi: true }} features={{ drop: true, crop: true }} top={<TopBar views={["dpi", "snap"]} />} right={<InspectorPanel frame={<DpiTab />} />} />,
    notes: { what: "A badge on frames below the profile’s warn / min DPI (300 / 150 by default); the exact value in the inspector; a DPI column in the assets panel.", where: "Canvas (DPI toggle in the top bar), inspector.", why: "Learn about blurry prints before ordering.", edge: ["Crop zoom and straightening lower the DPI — the badge updates live", "Orange < 300, red < 150", "Badges are hidden in Preview"] },
  },
  "print-overlays": {
    Demo: () => <Std init={printDoc} view={{ overlays: true }} features={{ drop: true, handles: true }} top={<TopBar views={["overlays", "grid", "snap"]} />} />,
    notes: { what: "Toggleable bleed, trim and safe-area lines; Preview hides everything except what will be printed.", where: "Top bar → Print overlays; Preview.", why: "Do not lose anything important at the trim.", edge: ["Values come from the printer profile", "A photo that does not reach the bleed is flagged by preflight"] },
  },
  "preflight-panel": {
    Demo: () => <Std init={printDoc} missing={["p11"]} view={{ overlays: true, dpi: true }} features={{ drop: true }} top={<PrintTopBar />} right={<PreflightPanel />} />,
    notes: { what: "A warnings panel by severity (errors / warnings / info) with a jump to the spread; counters update live.", where: "Preflight panel on the right.", why: "One “what is wrong” list instead of paging through the book.", edge: ["Clicking an item jumps there and selects the frame", "Errors block only Print PDF (panel button and Export → Print PDF); JPEG spreads and the static site stay available", "Empty — “Ready to print”"] },
  },
  "preflight-fixes": {
    Demo: () => <Std init={printDoc} missing={["p11"]} view={{ overlays: true, dpi: true }} features={{ drop: true }} top={<PrintTopBar />} right={<PreflightPanel fixes />} />,
    notes: { what: "Fix actions: relink, update modified, reset crop to cover, extend to bleed, move text into the safe area; text checks (minimum size, overset).", where: "Buttons under Preflight items.", why: "Fix in seconds instead of hunting for the setting.", edge: ["Every fix is a history step (Ctrl+Z)", "A fixed item disappears", "Not every problem has an automatic fix"] },
  },
  "pdf-export": { Demo: () => <ExportDialog kind="pdf" />, h: 560, notes: { what: "Pages or spreads according to the profile; progress in a worker, cancel, download; peak memory is kept in check.", where: "File → Export → Print PDF (and the button in Preflight).", why: "A file the printer will accept.", edge: ["Peak memory on 40 spreads stays under the limit", "Cancel frees the memory"] } },
  "jpeg-spreads-export": { Demo: () => <ExportDialog kind="jpeg" />, h: 560, notes: { what: "One sRGB JPEG per spread at the profile’s size and DPI.", where: "File → Export → JPEG spreads.", why: "For printers without PDF support and for social media.", edge: ["Naming: 01-cover.jpg, 02-pages-2-3.jpg…"] } },
  "pdf-captions": { Demo: PdfCaptions, auto: true, notes: { what: "Captions in the PDF look exactly as in the editor: the same embedded font files.", where: "Print PDF output compared with the editor canvas.", why: "What you lay out is what gets printed.", edge: ["Fonts are embedded as subsets", "A visual DOM-vs-PDF diff must stay under the threshold"] } },
  "print-package-report": { Demo: PrintReport, auto: true, notes: { what: "A short plain-text report for the printer next to the export.", where: "Written into the export folder together with book.pdf and cover.pdf.", why: "The printer gets profile, sizes and warnings without opening the app.", edge: ["Lowest DPI names the spread and file", "Errors are listed even if the user exported anyway"] } },
  "booklet-imposition": { Demo: Booklet, h: 600, notes: { what: "Sheet order for saddle stitching with blank pages added; imposition in the PDF; instructions for duplex printing.", where: "Export → Booklet (“Home printer” profile).", why: "Print a small booklet on a home printer.", edge: ["Page count is rounded up to a multiple of 4 — blanks are marked “·”", "Duplex printing: flip on the short edge"] } },
  "cover-editor": { Demo: CoverEditor, notes: { what: "The cover as a special spread: back / spine / front zones, crease and fold lines; spine width from the profile by page count.", where: "The first item of the spread list — Cover.", why: "A spine of the right width without calculations.", edge: ["Pages added — the spine is recalculated", "Spine text is vertical", "Barcode zone on the back"] } },
  "cover-pdf": { Demo: CoverPdf, auto: true, notes: { what: "A separate cover PDF with the cover bleed and the spine from the profile.", where: "Print export output next to book.pdf.", why: "Printers usually require the cover as its own file.", edge: ["Spine width follows the page count", "Cover bleed differs from page bleed"] } },
}

export const M8: Record<string, FeatureDef> = {
  onboarding: { Demo: Onboarding, h: 760, notes: { what: "One welcome screen with a single text-only Create Library button. It opens the system folder picker; the chosen folder becomes the one library and the empty library greets the user with an example cover and Create book.", where: "First run, before a library folder is set (#/screen/first-run).", why: "Understand the product in 10 seconds and make exactly one decision.", edge: ["No default path, no Continue step — the picker is the choice", "Picker cancelled → stays on the welcome screen", "Not shown again once a library folder is set", "The example cover is decorative; Create book is the only action"] } },
  "connect-own-hosting": { Demo: ConnectHosting, h: 560, notes: { what: "Step-by-step connection of your own Cloudflare account with minimal permissions.", where: "Settings → Hosting → Connect.", why: "For users without DevOps experience.", edge: ["Steps can be walked back", "The token is stored locally"] } },
  "site-settings": { Demo: SiteSettings, h: 560, notes: { what: "Site title, author, About page; live preview in the library style (v8: the Paper / Night / Sage theme switcher was removed).", where: "Settings → Site.", why: "The site looks like yours.", edge: ["Empty title → “Untitled site”", "The site has one look — the library style"] } },
  "printer-presets": { Demo: PrinterPresets, h: 560, notes: { what: "A catalogue of popular printer profiles and an editor for your own profile.", where: "Book settings → Print profile.", why: "No hunting for tech specs on the printer’s website.", edge: ["Built-in profiles are read-only — “Duplicate as custom”", "Values are validated (bleed ≥ 0, DPI 72–600)"] } },
}
