/* M6 Print + M8 For others */
import * as React from "react"
import { AlertTriangle, AlertCircle, Info, ArrowRight, FileDown, Loader2, CircleCheck, Printer, BookOpen, Wand2, Image as ImageIcon, FileText, Plus, Sparkles, Globe, KeyRound, ShieldCheck, Check } from "lucide-react"
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
import { TopBar, PanelHeader, MiniSpread } from "@/sandbox/chrome"
import { InspectorPanel, PhotoSection, CropSection, EmptyInspector, useSelected, MmField } from "@/sandbox/inspector"
import { P } from "@/data"
import { BOOKS } from "./screens"
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
const SEV = { error: [AlertCircle, "text-destructive", "Errors"], warning: [AlertTriangle, "text-warning", "Warnings"], info: [Info, "text-muted-foreground", "Info"] } as const
function PreflightPanel({ fixes = false }: { fixes?: boolean }) {
  const st = useStudio()
  const issues = useIssues()
  const jump = (i: Issue) => { st.setCur(i.si); if (i.fid) st.setSel([i.fid]); st.setStatus(`Spread ${i.si + 1}: ${i.msg}`) }
  return (
    <aside className="flex min-h-0 flex-col border-l bg-chrome" data-testid="preflight">
      <PanelHeader icon={<Printer />} title="Preflight" meta={<span className="flex items-center gap-1.5"><span className="text-destructive">{issues.filter((i) => i.sev === "error").length}</span>·<span className="text-warning">{issues.filter((i) => i.sev === "warning").length}</span></span>} />
      <div className="border-b px-3 py-2 text-xs text-muted-foreground">Profile: <b className="text-foreground">Saal Digital · 28×28 layflat</b></div>
      <div className="min-h-0 flex-1 overflow-auto">
        {issues.length === 0 && <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[13px]"><CircleCheck className="size-6 text-success" />Ready to print. No problems found.</div>}
        {(["error", "warning", "info"] as const).map((sev) => {
          const list = issues.filter((i) => i.sev === sev); if (!list.length) return null
          const [I, c, t] = SEV[sev]
          return (
            <div key={sev} className="border-b py-1">
              <div className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide", c)}><I className="size-3.5" />{t} · {list.length}</div>
              {list.map((i) => (
                <div key={i.id} className="group flex flex-col gap-1 px-3 py-1.5 hover:bg-accent/50">
                  <button type="button" onClick={() => jump(i)} className="flex items-start gap-2 text-left text-[12.5px]"><span className="mt-0.5 shrink-0 rounded bg-muted px-1 text-[10.5px] tabular-nums text-muted-foreground">{i.si + 1}</span><span className="min-w-0 flex-1">{i.msg}</span><ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" /></button>
                  {fixes && i.fix && <Button size="sm" variant="outline" className="ml-6 h-6 self-start gap-1 px-2 text-[11px] shadow-xs [&_svg]:size-3" onPress={() => { i.fix!.run(); st.setCur(i.si) }} data-testid="fix"><Wand2 />{i.fix.label}</Button>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <div className="border-t p-2.5"><Button className="h-8 w-full gap-1.5 text-[13px] [&_svg]:size-4" isDisabled={issues.some((i) => i.sev === "error")}><FileDown />Export print PDF</Button>{issues.some((i) => i.sev === "error") && <div className="mt-1.5 text-center text-[11px] text-muted-foreground">Fix errors first, or export anyway from the menu</div>}</div>
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
      <div className="grid h-full place-items-center bg-canvas">
        <div className="w-[560px] rounded-xl border bg-popover p-5 shadow-md" data-testid={`${kind}-export`}>
          <div className="flex items-center gap-3"><FeaturedIcon color="gray" theme="outline" size="md">{kind === "pdf" ? <FileText /> : <ImageIcon />}</FeaturedIcon><div><div className="font-medium">{kind === "pdf" ? "Export print PDF" : "Export JPEG spreads"}</div><div className="text-[13px] text-muted-foreground">Summer by the sea · 8 spreads · Saal Digital 28×28</div></div></div>
          {s === "opts" && (<>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {kind === "pdf" ? <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Output</span><Segmented label="Output" value={out} onChange={setOut} items={[{ id: "pages", label: "Pages" }, { id: "spreads", label: "Spreads" }]} /></div>
                : <SelectRow label="Resolution" defaultValue="300" items={[["300", "300 dpi · 6614×3307 px"], ["200", "200 dpi"]]} />}
              <SelectRow label="Profile" defaultValue="saal" items={[["saal", "Saal Digital 28×28"], ["blurb", "Blurb 10×8"], ["home", "Home printer A4"]]} />
            </div>
            <div className="mt-3 flex gap-1.5 overflow-hidden">{makeDoc().spreads.slice(0, 6).map((x) => <MiniSpread key={x.id} s={x} width={80} />)}</div>
            <div className="mt-3 text-xs text-muted-foreground">{kind === "pdf" ? "Original JPEG bytes, ICC profiles kept · bleed 3 mm · captions with embedded fonts" : "One sRGB JPEG per spread at profile size"}</div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline">Cancel</Button><Button onPress={() => { setP(0); setS("run") }} data-testid="run-export">Export</Button></div>
          </>)}
          {s === "run" && (<>
            <Progress value={p} aria-label="Export" className="mt-4" barClassName="h-1.5 bg-secondary dark:bg-accent" />
            <div className="mt-2 flex text-xs tabular-nums text-muted-foreground"><Loader2 className="mr-1.5 size-3.5 animate-spin" />{kind === "pdf" ? `Painting page ${Math.ceil(p / 6.25)} of 16 in a worker` : `Encoding spread ${Math.ceil(p / 12.5)} of 8`}<span className="ml-auto">peak memory {Math.round(180 + p * 1.2)} MB</span></div>
            <div className="mt-4 flex justify-end"><Button variant="outline" onPress={() => setS("opts")}>Cancel</Button></div>
          </>)}
          {s === "done" && (<>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[13px]"><CircleCheck className="size-4 text-success" />{kind === "pdf" ? "summer-by-the-sea.pdf · 16 pages · 182 MB" : "8 JPEG files · 64 MB"}</div>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onPress={() => setS("opts")}>Close</Button><Button className="gap-1.5 [&_svg]:size-4"><FileDown />Download</Button></div>
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
        <SliderRow label="Pages in the book" value={n} onChange={(v) => setN(v as number)} minValue={4} maxValue={32} className="w-72" />
        <div className="text-[13px]"><b>{sheets}</b> sheets · {pages - n} blank page{pages - n === 1 ? "" : "s"} added · saddle stitch</div>
        <Button className="ml-auto h-8 gap-1.5 text-[13px] [&_svg]:size-4"><FileDown />Export imposed PDF</Button>
      </div>
      <div className="grid grid-cols-4 gap-4" data-testid="booklet">
        {order.map(([a, b, c, d], i) => (
          <div key={i} className="rounded-lg border bg-card p-2.5 shadow-xs">
            <div className="mb-1.5 text-[11px] text-muted-foreground">Sheet {i + 1}</div>
            {[[a, b, "front"], [c, d, "back"]].map(([l, r, side]) => (
              <div key={String(side)} className="mb-1.5 flex items-center gap-1.5"><div className="flex flex-1 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/.1)]">{[l, r].map((x, j) => <div key={j} className={cn("grid h-12 flex-1 place-items-center text-[15px] font-semibold tabular-nums", (x as number) > n ? "bg-muted text-muted-foreground" : "bg-white text-[#2a2927]", j === 0 && "border-r")}>{lab(x as number)}</div>)}</div><span className="w-8 text-[10px] text-muted-foreground">{side as string}</span></div>
            ))}
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-3 text-[12.5px] leading-relaxed text-muted-foreground"><b className="text-foreground">Duplex:</b> print on both sides, flip on the short edge; fold the stack in half and staple at the fold.</div>
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
            <div className="absolute inset-0 rounded-sm bg-[#ddd8d0]" />
            <div className="absolute overflow-hidden bg-white shadow-md" style={{ left: wrap * sc * 0.82, top: wrap * sc * 0.82, width: tot * sc * 0.82, height: H * sc * 0.82 }}>
              <img src={P("p16").src} alt="" className="absolute right-0 top-0 h-full object-cover" style={{ width: W * sc * 0.82 }} />
              <div className="absolute left-0 top-0 flex h-full flex-col justify-end p-4 text-[11px] text-[#5f5b55]" style={{ width: W * sc * 0.82 }}><img src={P("p13").src} alt="" className="mb-3 h-24 w-full object-cover" />Back cover · ISBN / barcode zone</div>
              <div className="absolute top-0 flex h-full items-center justify-center bg-[#2a2927] text-white" style={{ left: W * sc * 0.82, width: spine * sc * 0.82 }}><span className="whitespace-nowrap font-[Lora_Variable,serif] text-[11px] [writing-mode:vertical-rl]">Summer by the sea</span></div>
              {[W, W + spine].map((x, i) => <div key={i} className="absolute inset-y-0 border-l border-dashed border-[#e0567a]" style={{ left: (x + (i ? hinge : -hinge)) * sc * 0.82 }} />)}
              <div className="absolute bottom-6 font-[Lora_Variable,serif] text-[19px] text-white drop-shadow" style={{ left: (W + spine + 12) * sc * 0.82 }}>Summer by the sea</div>
            </div>
            <span className="absolute -top-5 left-0 text-[10.5px] text-muted-foreground">wrap {wrap} mm</span>
            <span className="absolute -bottom-5 text-[10.5px] font-medium text-[#e0567a]" style={{ left: (wrap + W - 10) * sc * 0.82 }}>hinge · spine {spine} mm</span>
          </div>
          <div className="mt-4 flex gap-6 text-[11px] text-muted-foreground"><span>BACK</span><span>SPINE</span><span>FRONT</span></div>
        </div>
        <aside className="w-[264px] shrink-0 border-l bg-chrome">
          <Section title="Cover"><div className="flex flex-col gap-3">
            <SliderRow label="Pages" value={pages} onChange={(v) => setPages(v as number)} minValue={20} maxValue={120} step={4} />
            <SelectRow label="Paper" value={paper} onChange={setPaper} items={[["170", "Matte 170 g · 0.18 mm/page"], ["120", "Silk 120 g · 0.12 mm/page"]]} />
            <div className="rounded-md border bg-card p-2.5 text-[12.5px] tabular-nums">Spine: <b>{spine} mm</b> (formula from the profile)<br />Total: {Math.round(tot + wrap * 2)} × {H + wrap * 2} mm</div>
          </div></Section>
        </aside>
      </div>
    </StudioProvider>
  )
}

/* ---------------------------------------------------------------- M8 */
function Onboarding() {
  return <WithScenarios items={[["first", "First run"], ["sample", "With sample book"]]} initial="first" render={(v, set) => (
    <div className="grid h-full place-items-center bg-background p-8">
      <div className="w-[760px]" data-testid="onboarding">
        <div className="text-center"><div className="heading text-[30px]">Make a photobook from your folders</div><div className="mt-1 text-[14px] text-muted-foreground">Your photos stay on your disk. Photobooks only reads them.</div></div>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[[ImageIcon, "1 · Choose a folder", "Pick the folder with your trip photos."], [BookOpen, "2 · Lay out spreads", "Drag photos onto templates, or let them fill."], [Globe, "3 · Share or print", "Publish a site or export a print PDF."]].map(([I, t, d], i) => { const Ic = I as typeof ImageIcon; return (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-xs"><FeaturedIcon color="gray" theme="outline" size="md"><Ic /></FeaturedIcon><div className="mt-3 font-medium">{t as string}</div><div className="mt-1 text-[13px] text-muted-foreground">{d as string}</div></div>
          ) })}
        </div>
        <div className="mt-8 flex justify-center gap-3"><Button className="h-10 px-5">Choose a folder…</Button><Button variant="outline" className="h-10 gap-1.5 px-5 [&_svg]:size-4" onPress={() => set("sample")}><Sparkles />Open a sample book</Button></div>
        {v === "sample" && <div className="mt-6 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs"><img src={P("p16").src} alt="" className="h-14 w-20 rounded object-cover" /><div className="text-[13px]"><b>Sample: Summer by the sea</b><div className="text-muted-foreground">8 spreads, 20 CC0 photos — try anything, it is a copy.</div></div><Button size="sm" className="ml-auto">Open</Button></div>}
      </div>
    </div>
  )} />
}
function ConnectHosting() {
  const [step, setStep] = React.useState(0)
  const steps = ["Create a Cloudflare account", "Create a scoped token", "Paste and verify", "Choose a domain"]
  return (
    <div className="flex h-full bg-canvas">
      <aside className="w-[240px] shrink-0 border-r bg-chrome p-4">
        <div className="mb-3 text-[13px] font-medium">Connect your hosting</div>
        <ol className="flex flex-col gap-1">{steps.map((s, i) => <li key={s}><button type="button" onClick={() => setStep(i)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]", i === step ? "bg-accent font-medium" : "text-muted-foreground")}><span className={cn("grid size-5 place-items-center rounded-full border text-[10.5px]", i < step && "border-success bg-success text-white")}>{i < step ? <Check className="size-3" /> : i + 1}</span>{s}</button></li>)}</ol>
      </aside>
      <div className="grid flex-1 place-items-center p-6">
        <div className="w-[480px] rounded-xl border bg-popover p-5 shadow-md" data-testid="connect-hosting">
          <div className="text-[11px] text-muted-foreground">Step {step + 1} of 4</div>
          <div className="mt-1 font-medium">{steps[step]}</div>
          <div className="mt-2 text-[13px] text-muted-foreground">{[
            "Free plan is enough. We never see your password.",
            "Open the prepared link — the token is limited to one R2 bucket and nothing else.",
            "Paste the token. It is stored only on this computer.",
            "Use the free *.pages address or connect your own domain.",
          ][step]}</div>
          {step === 1 && <Button variant="outline" className="mt-3 gap-1.5 [&_svg]:size-4"><KeyRound />Open token page</Button>}
          {step === 2 && <TextField className="mt-3" aria-label="Token"><Input type="password" placeholder="paste token" className="h-9 font-mono text-[13px]" /></TextField>}
          {step === 3 && <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[13px]"><ShieldCheck className="size-4 text-success" />aleksandr.photos · DNS verified</div>}
          <div className="mt-5 flex justify-between"><Button variant="ghost" isDisabled={step === 0} onPress={() => setStep(step - 1)}>Back</Button><Button onPress={() => setStep(Math.min(3, step + 1))}>{step === 3 ? "Finish" : "Continue"}</Button></div>
        </div>
      </div>
    </div>
  )
}
function SiteSettings() {
  const [t, setT] = React.useState("Aleksandr’s photobooks")
  const [a, setA] = React.useState("Aleksandr Basov")
  const [about, setAbout] = React.useState("Trips, family and the sea. Printed and online.")
  const [th, setTh] = React.useState("light")
  const c = th === "light" ? { bg: "#faf8f5", fg: "#1f1d1a", mute: "#77716a" } : th === "dark" ? { bg: "#151413", fg: "#efebe5", mute: "#9a948c" } : { bg: "#f2f4f1", fg: "#1c2a22", mute: "#5f6f66" }
  return (
    <div className="flex h-full">
      <aside className="flex w-[300px] shrink-0 flex-col gap-3 border-r bg-chrome p-4" data-testid="site-settings">
        <div className="text-[13px] font-medium">Site settings</div>
        <TextField value={t} onChange={setT} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Site title</Label><Input className="h-8 text-[13px]" /></TextField>
        <TextField value={a} onChange={setA} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Author</Label><Input className="h-8 text-[13px]" /></TextField>
        <TextField value={about} onChange={setAbout} className="flex flex-col gap-1.5"><Label className="text-xs font-normal text-muted-foreground">About page</Label><TextArea className="min-h-20 text-[13px]" /></TextField>
        <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Theme</span><Segmented label="Theme" value={th} onChange={setTh} items={[{ id: "light", label: "Paper" }, { id: "dark", label: "Night" }, { id: "sage", label: "Sage" }]} /></div>
      </aside>
      <div className="flex-1 overflow-hidden p-6" style={{ background: c.bg, color: c.fg }}>
        <div className="font-[Lora_Variable,serif] text-[22px]">{t || "Untitled site"}</div>
        <div className="text-[12.5px]" style={{ color: c.mute }}>by {a || "—"}</div>
        <div className="mt-5 grid grid-cols-3 gap-4">{BOOKS.slice(0, 3).map((b) => <div key={b.id}><img src={P(b.cover).src} alt="" className="aspect-[4/3] w-full rounded-sm object-cover" /><div className="mt-1.5 font-[Lora_Variable,serif] text-[14px]">{b.title}</div></div>)}</div>
        <div className="mt-6 max-w-[420px] text-[13px] leading-relaxed" style={{ color: c.mute }}><b style={{ color: c.fg }}>About.</b> {about}</div>
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
        {list.map(([id, n, d, r]) => <button key={id} type="button" onClick={() => setSel(id)} className={cn("flex w-full items-center gap-2.5 rounded-lg p-2 text-left", sel === id ? "bg-accent" : "hover:bg-accent/50")}>{id === "custom" ? <Plus className="size-4 text-muted-foreground" /> : <Printer className="size-4 text-muted-foreground" />}<span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{n}</span><span className="block text-xs text-muted-foreground">{d}</span></span>{r && <Badge color="gray">{r}</Badge>}</button>)}
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
          {sel !== "custom" && <Button variant="outline" size="sm" className="mt-3">Duplicate as custom</Button>}
        </div>
      </div>
    </div>
  )
}
function DpiTab() { const { f } = useSelected(); return f ? <><PhotoSection /><CropSection /></> : <EmptyInspector hint="Select a frame — frames under 300 dpi show an orange badge." /> }

function PdfCaptions() {
  return (
    <Dev>
      <div className="grid grid-cols-2 gap-4">{["Editor (DOM)", "PDF"].map((t) => <SpecCard key={t} title={t}><div className="rounded bg-white p-4 text-[#232220]"><img src={P("p13").src} alt="" className="h-40 w-full object-cover" /><div className="mt-2 font-[Inter_Variable] text-[12px]">Morning swim before breakfast · Jul 14</div></div></SpecCard>)}</div>
    </Dev>
  )
}
function PrintReport() {
  return (
    <Dev>
      <SpecCard title="summer-by-the-sea.report.txt"><pre className="font-mono text-[12.5px] leading-relaxed">{`Profile      Saal Digital · 28×28 layflat
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
      <SpecCard title="cover.pdf"><div className="flex items-center gap-1"><div className="h-40 w-56 bg-cover" style={{ backgroundImage: `url(${P("p13").src})` }} /><div className="h-40 w-5 bg-[#2a2927]" /><div className="h-40 w-56 bg-cover" style={{ backgroundImage: `url(${P("p16").src})` }} /></div><div className="mt-2 text-xs text-muted-foreground">430.2 × 310 mm · cover bleed 15 mm · spine 5.2 mm</div></SpecCard>
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
    Demo: () => <Std init={printDoc} missing={["p11"]} view={{ overlays: true, dpi: true }} features={{ drop: true }} right={<PreflightPanel />} />,
    notes: { what: "A warnings panel by severity (errors / warnings / info) with a jump to the spread; counters update live.", where: "Preflight panel on the right.", why: "One “what is wrong” list instead of paging through the book.", edge: ["Clicking an item jumps there and selects the frame", "Errors disable the export button (“export anyway” is in the menu)", "Empty — “Ready to print”"] },
  },
  "preflight-fixes": {
    Demo: () => <Std init={printDoc} missing={["p11"]} view={{ overlays: true, dpi: true }} features={{ drop: true }} right={<PreflightPanel fixes />} />,
    notes: { what: "Fix actions: relink, update modified, reset crop to cover, extend to bleed, move text into the safe area; text checks (minimum size, overset).", where: "Buttons under Preflight items.", why: "Fix in seconds instead of hunting for the setting.", edge: ["Every fix is a history step (Ctrl Z)", "A fixed item disappears", "Not every problem has an automatic fix"] },
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
  onboarding: { Demo: Onboarding, notes: { what: "A start screen explaining the process, a sample book, helpful empty states.", where: "First run, empty library.", why: "Understand the product in 10 seconds.", edge: ["The sample is a copy — it is safe to break", "Not shown again"] } },
  "connect-own-hosting": { Demo: ConnectHosting, h: 560, notes: { what: "Step-by-step connection of your own Cloudflare account with minimal permissions.", where: "Settings → Hosting → Connect.", why: "For users without DevOps experience.", edge: ["Steps can be walked back", "The token is stored locally"] } },
  "site-settings": { Demo: SiteSettings, h: 560, notes: { what: "Site title, author, About page, theme choice; live preview.", where: "Settings → Site.", why: "The site looks like yours.", edge: ["Empty title → “Untitled site”", "The site theme does not affect the editor theme"] } },
  "printer-presets": { Demo: PrinterPresets, h: 560, notes: { what: "A catalogue of popular printer profiles and an editor for your own profile.", where: "Book settings → Print profile.", why: "No hunting for tech specs on the printer’s website.", edge: ["Built-in profiles are read-only — “Duplicate as custom”", "Values are validated (bleed ≥ 0, DPI 72–600)"] } },
}
