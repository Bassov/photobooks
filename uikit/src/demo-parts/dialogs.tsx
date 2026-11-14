import * as React from "react"
import { CircleAlert, CircleCheck, ExternalLink, Folder, Info, Loader2, TriangleAlert, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/uui/Badge"
import { P } from "@/data"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Segmented } from "@/components/app/controls"
import { AppModal } from "@/components/app/ui"
import { FolderPicker } from "@/features/screens"
import { useStudio, type Book, type Studio } from "@/sandbox/store"
import { PRESETS, pagesOf, fmtN } from "@/sandbox/v7"
import { SAMPLE_HOSTING, slug, useRun, useSession, type HostingRecord } from "./session"
import { CATALOG, profileBleed, type KitProfile } from "./printProfiles"
import { checkLabel, libraryLabel, openSamplePdf, pageList, printCheckRows, printFailText, printProgress, printSummary, takePrintFail, type CheckSeverity, type PrintFail } from "./printCheck"

export type RunStep = "opts" | "run" | "done" | "failed"
export type PublishStep = "connect" | "opts" | "run" | "done" | "failed"
export type PublishFail = "offline" | "timeout" | "other" | "cors" | "key" | "denied" | "bucket" | "build"
export type PublishRun = { phase: ExportPhase; p: number; fail: PublishFail; sent: number; total: number; start: (fail?: PublishFail) => void; seen: () => void }
/** Kit stand-in for the publish worker (in-app-publish §3), shaped like `useExportRun`: the run outlives the dialog, "done" shows
 *  for 4 s, "failed" stays until `seen()`. `start(fail)` fails at once (a stored hosting record that can't connect). */
export function usePublishRun(ms = 1400): PublishRun {
  const [phase, setPhase] = React.useState<ExportPhase>("idle")
  const [fail, setFail] = React.useState<PublishFail>("timeout")
  const p = useRun(phase === "run", ms, () => setPhase("done"))
  React.useEffect(() => { if (phase !== "done") return; const t = setTimeout(() => setPhase("idle"), 4000); return () => clearTimeout(t) }, [phase])
  return {
    phase, p: phase === "run" ? p : 0, fail, sent: 0, total: 40,
    start: (f) => { if (f) { setFail(f); setPhase("failed") } else setPhase("run") },
    seen: () => setPhase((x) => (x === "failed" ? "idle" : x)),
  }
}
/** The failure a stored, not-connecting hosting record gives a publish (publish-credentials codes → in-app-publish §2 codes). */
export function publishFailOf(h: HostingRecord | null): PublishFail | undefined {
  if (!h || h.ok) return undefined
  return ({ InvalidAccessKeyId: "key", AccessDenied: "denied", NoSuchBucket: "bucket", Cors: "cors", Offline: "offline", Timeout: "timeout" } as const)[h.code ?? "Timeout"]
}
const RETRYABLE: ReadonlySet<PublishFail> = new Set(["offline", "timeout", "other", "build"])
const publishFailText = (f: PublishFail, bucket: string) => ({
  offline: "You're offline. Connect to the internet and try again.",
  timeout: "Cloudflare didn't answer in 30 seconds.",
  other: "Cloudflare answered 503 SlowDown.",
  cors: "Cloudflare blocked the upload from this page. Check the CORS policy in Settings → Hosting.",
  key: "Cloudflare doesn't recognise this key. It may have been deleted or rolled. Replace the token in Settings → Hosting.",
  denied: `This token can't write to “${bucket}”. Give it Object Read & Write on this bucket.`,
  bucket: `There's no bucket “${bucket}” in this account.`,
  build: "Something went wrong while preparing the site. Try again.",
})[f]
const publishPhase = (v: number) => (v < 50 ? "Rendering web images" : v < 95 ? "Uploading changed files" : "Finishing")
/** #/demo Publish dialog (Designer in-app-publish §2): connect (no stored hosting) | options → running (Hide keeps it
 *  running in the pill) → done (book link) / failed. Every step closes on Esc / outside click; the run step hides. */
export function PublishDialog({ title, otherBooks, initialStep, fail, run, onHide, onOpenSite = () => {}, onOpenHosting = () => {} }: {
  title: string; otherBooks: string[]; initialStep?: PublishStep; fail?: PublishFail; run?: PublishRun; onHide: () => void; onOpenSite?: () => void; onOpenHosting?: () => void
}) {
  const own = usePublishRun()
  const r = run ?? own
  const stored = useSession().useDemo().hosting // publish-credentials D11: the host of the stored site address
  const [step, setStep] = React.useState<PublishStep>(initialStep ?? (stored ? "opts" : "connect"))
  // the run ends while the dialog is open: move to Done / Failed in place
  React.useEffect(() => { if (step === "run" && (r.phase === "done" || r.phase === "failed")) setStep(r.phase) }, [step, r.phase])
  const go = () => { const f = publishFailOf(stored); r.start(f); setStep(f ? "failed" : "run") }
  const site = (stored ?? SAMPLE_HOSTING).publicBaseUrl
  const why = fail ?? r.fail
  const retry = RETRYABLE.has(why)
  const sent = retry && r.sent > 0 ? ` ${r.sent} of ${r.total} files went up. Try again to send the rest.` : ""
  const heading = "heading flex items-center gap-2 text-xl leading-tight [&_svg]:size-5"
  const text = "mt-1 text-sm text-muted-foreground"
  const btns = "mt-5 flex justify-end gap-2"
  // a step change unmounts the pressed button: each later step's main button takes focus, so Esc still reaches the dialog
  const hosting = <Button size="md" className="px-4" onPress={onOpenHosting} autoFocus data-testid="publish-open-hosting">Open Settings → Hosting</Button>
  return (
    <AppModal isOpen width={480} onOpenChange={(o) => { if (!o) onHide() }}>
      <div className="px-6 pb-5 pt-5" data-testid="publish-dialog" data-step={step}>
        {step === "connect" && <>
          <div className="heading text-xl leading-tight">Publish to your site</div>
          <p className={text}>Connect your hosting first. Publish uploads your books to your own Cloudflare R2 bucket, which you connect once in Settings.</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide}>Cancel</Button>{hosting}</div>
        </>}
        {step === "opts" && <>
          <div className="heading text-xl leading-tight">Publish to your site</div>
          <p className={text} data-testid="publish-host-line">“{title}” goes to <span className="font-medium text-foreground">{new URL(site).host}</span>{otherBooks.length ? " with the other published books." : "."}</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide}>Cancel</Button><Button size="md" className="px-4" onPress={go} data-testid="publish-go">Publish</Button></div>
        </>}
        {step === "run" && <>
          <div className={heading}><Loader2 className="animate-spin motion-reduce:animate-none" />Publishing…</div>
          <p className={text}>{publishPhase(r.p)} · {r.p}%</p>
          <Progress aria-label="Publishing" value={r.p} className="mt-4" barClassName="h-1.5 bg-secondary" data-testid="publish-progress" />
          <p className="mt-3 text-xs text-muted-foreground">You can keep editing. Changes from now on go into the next publish.</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide} autoFocus data-testid="publish-hide">Hide</Button></div>
        </>}
        {step === "done" && <>
          <div className={heading}><CircleCheck />Published</div>
          <p className={text}>The book is live. Anyone with the link can see it.</p>
          <div className="mt-4 select-all truncate rounded-md bg-field px-3 py-2 font-mono text-sm" data-testid="publish-link">{`${site}/books/${slug(title)}/`}</div>
          <p className="mt-2 text-xs text-muted-foreground" data-testid="publish-summary">14 changed files uploaded · 3.2 MB. 186 were already up to date.</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide}>Done</Button>
            <Button size="md" className="px-4" onPress={onOpenSite} autoFocus data-testid="publish-open-site">Open site</Button></div>
        </>}
        {step === "failed" && <>
          <div className={heading}><TriangleAlert />Publish didn't finish</div>
          <p className={text} data-testid="publish-error">{publishFailText(why, stored?.bucket ?? SAMPLE_HOSTING.bucket)}{sent}</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide}>Close</Button>
            {retry ? <Button size="md" className="px-4" onPress={go} autoFocus data-testid="publish-retry">Try again</Button> : hosting}</div>
        </>}
      </div>
    </AppModal>
  )
}
/** pdf-export D3: 2-up / 4-up stay hidden until `booklet-imposition` owns them. */
const IMPOSITION: boolean = false
const SEVERITY_ROW: Record<CheckSeverity, [LucideIcon, string]> = {
  error: [CircleAlert, "font-medium text-destructive-solid"], warning: [TriangleAlert, "text-warning-fg"], info: [Info, "text-muted-foreground"],
}
/** §2.1 check row: icon 16 centred on the first line, page list muted. */
function CheckLine({ icon: Icon, className, children, pages = [], rule }: { icon: LucideIcon; className: string; children: React.ReactNode; pages?: number[]; rule?: string }) {
  return <li className={`flex items-start gap-2 text-sm ${className}`} data-testid="print-check-row" data-rule={rule}><span className="flex h-lh shrink-0 items-center"><Icon className="size-4" /></span><span>{children}{pages.length > 0 && <span className="font-normal text-muted-foreground">{pageList(pages)}</span>}</span></li>
}
/** #/demo Print dialog (Designer pdf-export §2.1–2.4): options + Check → exporting (Hide) → PDF ready / failed. */
export function PrintDialog({ book, spreads, title, onClose, profile = CATALOG[0], initialStep = "opts", initialImposition = "single", initialBleed = true }: {
  book: Book; spreads: number; title: string; onClose: () => void; /** the book's print profile (printer-presets; default Generic) */ profile?: KitProfile
  initialStep?: RunStep; initialImposition?: "single" | "2up" | "4up"; initialBleed?: boolean
}) {
  const bleedMm = profileBleed(profile)
  const [step, setStep] = React.useState<RunStep>(initialStep)
  const [fail, setFail] = React.useState<PrintFail>("other")
  // v0.8.1 (P2-5): print uses the book's real size and page count
  const size = `${fmtN(book.w)} × ${fmtN(book.h)} cm`
  const known = PRESETS.find((p) => (p.w === book.w && p.h === book.h) || (p.w === book.h && p.h === book.w))
  const preset = known?.id ?? "custom"
  const [impPicked, setImp] = React.useState<string>(initialImposition)
  const imp = IMPOSITION ? impPicked : "single"
  const [bleed, setBleed] = React.useState(initialBleed)
  const v = useRun(step === "run", 1400, () => setStep("done"))
  const pages = pagesOf(spreads)
  const per = imp === "4up" ? 8 : imp === "2up" ? 4 : 1
  const sheets = Math.ceil(pages / per)
  const file = `${slug(title)}-${known ? preset : `${fmtN(book.w)}x${fmtN(book.h)}cm`}${imp !== "single" ? `-${imp}` : ""}.pdf`
  const library = libraryLabel(useSession().useDemo().path)
  // the check (D6): a stand-in for the PDF worker over the studio doc; it runs on open and again when the profile changes
  const st = useStudio() as Studio | null
  const [checking, setChecking] = React.useState(true)
  React.useEffect(() => { setChecking(true); const t = setTimeout(() => setChecking(false), 800); return () => clearTimeout(t) }, [profile.id])
  const rows = React.useMemo(() => (st ? printCheckRows(st.doc, st.book, st.missing, profile) : []), [st?.doc, st?.book, st?.missing, profile])
  const errors = rows.some((r) => r.severity === "error")
  const skipped = rows.find((r) => r.rule === "asset-missing")
  const skippedN = new Set(st?.doc.spreads.flatMap((s) => s.frames.map((f) => f.photo)).filter((id) => id && st.missing.has(id))).size
  const go = () => { const f = takePrintFail(); if (f) { setFail(f); setStep("failed") } else setStep("run") }
  const run = printProgress(v, sheets)
  const heading = "heading flex items-center gap-2 text-xl leading-tight [&_svg]:size-5"
  const text = "mt-1 text-sm text-muted-foreground"
  const btns = "mt-5 flex justify-end gap-2"
  // a step change unmounts the pressed button: each later step's main button takes focus, so Esc still reaches the dialog
  return (
    <AppModal isOpen width={500} onOpenChange={(o) => { if (!o) onClose() }}>
      <div className="px-6 pb-5 pt-5" data-testid="print-dialog" data-step={step}>
        {step === "opts" && <>
          <div className="heading text-xl leading-tight">Print</div>
          <p className={text}>A PDF for a print shop or a home duplex printer.</p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm" data-testid="print-size"><span className="text-muted-foreground">Page size</span><span className="tabular-nums">{known ? known.name : "Custom"} · {size}</span></div>
            <div className="flex items-center justify-between text-sm" data-testid="print-profile"><span className="text-muted-foreground">Printer</span><span>{profile.name}</span></div>
            {IMPOSITION
              ? <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Imposition (duplex)</span><Segmented label="Imposition" value={imp} onChange={setImp} items={[{ id: "single", label: "1 per sheet" }, { id: "2up", label: "2-up" }, { id: "4up", label: "4-up" }]} /></div>
              : <div className="flex items-center justify-between text-sm" data-testid="print-imposition"><span className="text-muted-foreground">Imposition</span><span>1 per sheet</span></div>}
            <Checkbox isSelected={bleed} onChange={setBleed} data-testid="print-bleed">Add {fmtN(bleedMm)} mm bleed and crop marks</Checkbox>
            <div className="text-xs text-muted-foreground" data-testid="print-summary">{printSummary(pages, sheets, bleed ? bleedMm : null)}</div>
            <div className="flex flex-col gap-1.5" data-testid="print-check" data-state={checking ? "checking" : rows.length ? "issues" : "clean"}>
              <span className="text-xs text-muted-foreground">{checking ? "Check" : checkLabel(rows)}</span>
              <ul className="scroll-thin flex max-h-[118.25px] flex-col gap-1.5 overflow-y-auto" data-testid="print-check-list">
                {checking ? <CheckLine icon={Loader2} className="text-muted-foreground [&_svg]:animate-spin motion-reduce:[&_svg]:animate-none">Checking the book…</CheckLine>
                  : !rows.length ? <CheckLine icon={CircleCheck} className="text-foreground">No problems found</CheckLine>
                    : rows.map((r) => <CheckLine key={r.rule} icon={SEVERITY_ROW[r.severity][0]} className={SEVERITY_ROW[r.severity][1]} pages={r.pages} rule={r.rule}>{r.text}</CheckLine>)}
              </ul>
              {!checking && errors && <p className="text-xs text-muted-foreground" data-testid="print-check-note">Print shops may refuse a PDF with errors. You can still export it, for example to proof it.</p>}
            </div>
          </div>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Cancel</Button><Button size="md" className="px-4" onPress={go} data-testid="print-go">Export PDF</Button></div>
        </>}
        {step === "run" && <>
          <div className={heading}><Loader2 className="animate-spin motion-reduce:animate-none" />Exporting PDF…</div>
          <p className={`${text} tabular-nums`} data-testid="print-run-text">{run.text}</p>
          <Progress aria-label="Exporting PDF" value={run.p} className="mt-4" barClassName="h-1.5 bg-secondary" data-testid="print-progress" />
          <p className="mt-3 text-xs text-muted-foreground">You can keep editing. Changes from now on aren’t in this PDF.</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onClose} autoFocus data-testid="print-hide">Hide</Button></div>
        </>}
        {step === "done" && <>
          <div className={heading}><CircleCheck />PDF ready</div>
          <p className={text} data-testid="print-done">{file} · {sheets} pages · {(sheets * 1.92).toFixed(1)} MB</p>
          <p className="mt-1.5 text-xs text-muted-foreground" data-testid="print-saved">Saved in {library}/exports.</p>
          {skipped && <ul className="mt-3" data-testid="print-skipped"><CheckLine icon={TriangleAlert} className={SEVERITY_ROW.warning[1]} pages={skipped.pages}>{skippedN} {skippedN === 1 ? "photo" : "photos"} couldn’t be read and print{skippedN === 1 ? "s" : ""} as blank paper</CheckLine></ul>}
          <div className={btns}><Button variant="ghost" size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => openSamplePdf(file)} data-testid="print-open"><ExternalLink />Open PDF</Button>
            <Button size="md" className="px-4" onPress={onClose} autoFocus data-testid="print-close">Done</Button></div>
        </>}
        {step === "failed" && <>
          <div className={heading}><TriangleAlert />PDF not exported</div>
          <p className={text} data-testid="print-error">{printFailText(fail, library)}</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Close</Button>
            <Button size="md" className="px-4" onPress={go} autoFocus data-testid="print-retry">Try again</Button></div>
        </>}
      </div>
    </AppModal>
  )
}

export type ExportPhase = "idle" | "run" | "done" | "failed"
export type ExportStep = "opts" | "run" | "done" | "failed"
export type ExportFail = "access" | "foreign" | "full" | "unknown"
export type ExportRun = { phase: ExportPhase; p: number; fail: ExportFail; folder?: string; start: (folder: string) => void; seen: () => void }
/** Kit stand-in for the site export worker. The run outlives the dialog (Hide keeps it going), "Exported" shows for 4 s,
 *  "Failed" stays until `seen()` (the pill opened the dialog). The picker folder "Family" holds a foreign dist/. */
export function useExportRun(ms = 1400): ExportRun {
  const [phase, setPhase] = React.useState<ExportPhase>("idle")
  const [fail, setFail] = React.useState<ExportFail>("unknown")
  const [folder, setFolder] = React.useState<string>()
  const p = useRun(phase === "run", ms, () => setPhase("done"))
  React.useEffect(() => { if (phase !== "done") return; const t = setTimeout(() => setPhase("idle"), 4000); return () => clearTimeout(t) }, [phase])
  return {
    phase, p: phase === "run" ? p : 0, fail, folder,
    start: (f) => { setFolder(f); if (f === "Family") { setFail("foreign"); setPhase("failed") } else setPhase("run") },
    seen: () => setPhase((x) => (x === "failed" ? "idle" : x)),
  }
}
/** "“Lake trip” as it is now, plus 2 books from earlier exports: Fog, Summer ’25." (names newest first, 3 at most). */
export function exportBooksLine(title: string, others: string[]) {
  if (!others.length) return `“${title}” as it is now.`
  const names = others.length > 3 ? `${others.slice(0, 3).join(", ")} and ${others.length - 3} more` : others.join(", ")
  return `“${title}” as it is now, plus ${others.length} book${others.length === 1 ? "" : "s"} from earlier exports: ${names}.`
}
const exportPhase = (v: number) => (v < 30 ? "Preparing photos" : v < 80 ? "Rendering pages" : "Writing files")
const exportFailText = (f: ExportFail, name: string) =>
  f === "access" ? `Photobooks can’t write to “${name}”. Allow access to the folder and try again.`
    : f === "foreign" ? `dist in “${name}” isn’t a Photobooks export, so it was left as it is. Choose another folder.`
      : f === "full" ? "The disk is full." : "Something went wrong while writing the site. Try again."
const PRIMARY_OFF = "data-[disabled]:bg-muted data-[disabled]:text-muted-foreground data-[disabled]:opacity-100"
/** #/demo Export site dialog: a local folder export (no hosting). Options → running (Hide keeps it running) → done / failed. */
export function ExportSiteDialog({ title, otherBooks, folder, initialStep = "opts", fail, run, onHide }: {
  title: string; otherBooks: string[]; folder?: string; initialStep?: ExportStep; fail?: ExportFail; run?: ExportRun; onHide: () => void
}) {
  const own = useExportRun()
  const r = run ?? own
  const [step, setStep] = React.useState<ExportStep>(initialStep)
  const [dir, setDir] = React.useState(folder ?? r.folder)
  const [picking, setPicking] = React.useState(false)
  // the run ends while the dialog is open: move to Done / Failed in place
  React.useEffect(() => { if (step === "run" && (r.phase === "done" || r.phase === "failed")) setStep(r.phase) }, [step, r.phase])
  const go = () => { if (dir) { r.start(dir); setStep("run") } }
  const why = fail ?? r.fail
  const books = otherBooks.length + 1
  const btns = "mt-5 flex justify-end gap-2"
  return <>
    <AppModal isOpen width={480} onOpenChange={(o) => { if (!o && !picking) onHide() }}>
      <div className="px-6 pb-5 pt-5" data-testid="export-site-dialog" data-step={step}>
        {step === "opts" && <>
          <div className="heading text-xl leading-tight">Export site</div>
          <p className="mt-1 text-sm text-muted-foreground">Writes a website of your books to a folder on this computer. Nothing is uploaded.</p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Folder</span>
              {dir ? <div className="flex items-center gap-2">
                <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md bg-field px-3 text-sm shadow-xs [&_svg]:size-4 [&_svg]:shrink-0" data-testid="export-site-folder"><Folder /><span className="truncate">{dir}</span></div>
                <Button variant="ghost" size="sm" className="px-3" onPress={() => setPicking(true)} data-testid="export-site-change">Change…</Button>
              </div> : <Button variant="secondary" size="sm" className="self-start px-3 shadow-xs [&_svg]:size-4" onPress={() => setPicking(true)} data-testid="export-site-choose"><Folder />Choose folder…</Button>}
              {dir && <p className="text-xs text-muted-foreground">The site goes into {dir}/dist. An earlier export there is replaced.</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Books</span>
              <p className="text-sm" data-testid="export-site-books">{exportBooksLine(title, otherBooks)}</p>
            </div>
          </div>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide}>Cancel</Button>
            <Button size="md" className={`px-4 ${PRIMARY_OFF}`} isDisabled={!dir} onPress={go} data-testid="export-site-go">Export</Button></div>
        </>}
        {step === "run" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><Loader2 className="size-5 animate-spin motion-reduce:animate-none" />Exporting…</div>
          <p className="mt-1 text-sm text-muted-foreground">{exportPhase(r.p)} · {r.p}%</p>
          <Progress aria-label="Exporting site" value={r.p} className="mt-4" barClassName="h-1.5 bg-secondary" data-testid="export-site-progress" />
          <p className="mt-3 text-xs text-muted-foreground">You can keep editing. Changes from now on go into the next export.</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide} data-testid="export-site-hide">Hide</Button></div>
        </>}
        {step === "done" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><CircleCheck className="size-5" />Site exported</div>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="export-site-summary">{books} book{books === 1 ? "" : "s"} · {22 + 64 * books} files · {(16.07 * books).toFixed(1)} MB in {dir}/dist.</p>
          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">To open it, serve the folder with a local web server, for example:</span>
            <div className="rounded-md bg-field px-3 py-2 font-mono text-sm">npx serve dist</div>
          </div>
          <div className={btns}><Button size="md" className="px-4" onPress={onHide} data-testid="export-site-close">Done</Button></div>
        </>}
        {step === "failed" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><TriangleAlert className="size-5" />Export failed</div>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="export-site-error">{exportFailText(why, dir ?? "")}</p>
          <div className={btns}><Button variant="ghost" size="md" className="px-4" onPress={onHide} data-testid="export-site-close">Close</Button>
            {why === "foreign"
              ? <Button size="md" className="px-4" onPress={() => { setDir(undefined); setStep("opts") }} data-testid="export-site-rechoose">Choose folder…</Button>
              : <Button size="md" className="px-4" onPress={go} data-testid="export-site-retry">Try again</Button>}</div>
        </>}
      </div>
    </AppModal>
    <FolderPicker isOpen={picking} title="Choose a folder for the site" onCancel={() => setPicking(false)} onPick={(p) => { setPicking(false); setDir(p.split("/").filter(Boolean).pop() ?? p) }} />
  </>
}

/** Relink dialog (port of the product `src/editor/relink/RelinkDialog.tsx`): photos whose files can't be found, matched by a rescanned folder.
 *  Skip keeps the book editable with hatched frames; Resolve relinks the matches. */
export function RelinkDialog({ missing, found, onRescan, onResolve, onSkip }: {
  missing: string[]; found: ReadonlySet<string>; onRescan: () => void; onResolve: () => void; onSkip: () => void
}) {
  const open = missing.length - found.size
  const title = open > 0 ? `${open} photo${open === 1 ? "" : "s"} need${open === 1 ? "s" : ""} attention` : "No photos need attention"
  return (
    <AppModal isOpen width={560} isDismissable={false}>
      <div data-testid="relink-dialog">
        <header className="px-6 pb-2 pt-5">
          <div className="heading text-xl leading-tight" data-testid="relink-title">{title}</div>
          <p className="mt-1 text-sm text-muted-foreground">Rescan a folder to match photos by path, size, and date. Skip keeps the book editable with hatched frames.</p>
        </header>
        <div className="scroll-thin mx-6 mt-2 max-h-[280px] overflow-auto rounded-lg bg-field" data-testid="relink-list" tabIndex={0}>
          {missing.map((id) => (
            <div key={id} className="flex items-center justify-between gap-3 px-3 py-2" data-testid="relink-row" data-asset-id={id} data-status={found.has(id) ? "found" : "missing"}>
              <span className="min-w-0 truncate text-sm font-semibold">{P(id).name}</span>
              <Badge color={found.has(id) ? "success" : "error"} type="pill-color" dot>{found.has(id) ? "Found" : "Missing"}</Badge>
            </div>
          ))}
        </div>
        <footer className="mt-4 flex items-center justify-end gap-2 px-6 pb-5">
          <Button variant="ghost" size="sm" className="px-3" onPress={onSkip} data-testid="relink-skip">Skip for now</Button>
          <Button variant="secondary" size="sm" className="px-3" onPress={onRescan} data-testid="relink-rescan">Rescan folder…</Button>
          <Button size="sm" className="px-3" isDisabled={found.size === 0} disabledReason={found.size === 0 ? "Rescan a folder first — nothing to resolve yet" : undefined} onPress={onResolve} data-testid="relink-resolve">{found.size ? `Resolve ${found.size}` : "Resolve"}</Button>
        </footer>
      </div>
    </AppModal>
  )
}
