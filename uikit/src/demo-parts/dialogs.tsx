import * as React from "react"
import { CircleCheck, Loader2, FolderOpen, Folder, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/uui/Badge"
import { P } from "@/data"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Segmented, SelectRow } from "@/components/app/controls"
import { AppModal } from "@/components/app/ui"
import { FolderPicker } from "@/features/screens"
import type { Book } from "@/sandbox/store"
import { PRESETS, pagesOf, fmtN } from "@/sandbox/v7"
import { slug, useRun } from "./session"

export type RunStep = "opts" | "run" | "done"
/** #/demo Publish dialog: options → progress → link. */
export function PublishDialog({ title, onClose, onOpenSite = () => {}, initialStep = "opts", initialSize = "2048", initialDownload = false }: {
  title: string; onClose: () => void; onOpenSite?: () => void; initialStep?: RunStep; initialSize?: "1600" | "2048" | "3200"; initialDownload?: boolean
}) {
  const [step, setStep] = React.useState<RunStep>(initialStep)
  const [size, setSize] = React.useState<string>(initialSize)
  const [dl, setDl] = React.useState(initialDownload)
  const v = useRun(step === "run", 1400, () => setStep("done"))
  const link = `https://aleksandr.photos/${slug(title)}`
  return (
    <AppModal isOpen width={480} onOpenChange={(o) => { if (!o && step !== "run") onClose() }} isDismissable={step !== "run"}>
      <div className="px-6 pb-5 pt-5" data-testid="publish-dialog" data-step={step}>
        {step === "opts" && <>
          <div className="heading text-xl leading-tight">Publish to your site</div>
          <p className="mt-1 text-sm text-muted-foreground">“{title}” goes to aleksandr.photos with the other published books.</p>
          <div className="mt-4 flex flex-col gap-3">
            <SelectRow label="Web image size" value={size} onChange={setSize} items={[["1600", "1600 px · smaller site"], ["2048", "2048 px · recommended"], ["3200", "3200 px · sharp on large screens"]]} />
            <Checkbox isSelected={dl} onChange={setDl}>Let visitors download a PDF</Checkbox>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Cancel</Button><Button size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => setStep("run")} data-testid="publish-go">Publish</Button></div>
        </>}
        {step === "run" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><Loader2 className="size-5 animate-spin" />Publishing…</div>
          <p className="mt-1 text-sm text-muted-foreground">{v < 50 ? "Rendering web images" : v < 90 ? "Uploading changed files" : "Finishing"} · {v}%</p>
          <Progress aria-label="Publishing" value={v} className="mt-4" barClassName="h-1.5 bg-secondary" data-testid="publish-progress" />
        </>}
        {step === "done" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><CircleCheck className="size-5" />Published</div>
          <p className="mt-1 text-sm text-muted-foreground">The book is live. Anyone with the link can see it.</p>
          <div className="mt-4 truncate rounded-md bg-field px-3 py-2 font-mono text-sm" data-testid="publish-link">{link}</div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Done</Button>
            <Button size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={onOpenSite} data-testid="publish-open-site">Open site</Button></div>
        </>}
      </div>
    </AppModal>
  )
}
/** #/demo Print dialog: options → progress → PDF ready. */
export function PrintDialog({ book, spreads, title, onClose, initialStep = "opts", initialImposition = "2up", initialBleed = true }: {
  book: Book; spreads: number; title: string; onClose: () => void; initialStep?: RunStep; initialImposition?: "single" | "2up" | "4up"; initialBleed?: boolean
}) {
  const [step, setStep] = React.useState<RunStep>(initialStep)
  // v0.8.1 (P2-5): print uses the book's real size and page count
  const size = `${fmtN(book.w)} × ${fmtN(book.h)} cm`
  const known = PRESETS.find((p) => (p.w === book.w && p.h === book.h) || (p.w === book.h && p.h === book.w))
  const preset = known?.id ?? "custom"
  const [imp, setImp] = React.useState<string>(initialImposition)
  const [bleed, setBleed] = React.useState(initialBleed)
  const [shown, setShown] = React.useState(false)
  const v = useRun(step === "run", 1400, () => setStep("done"))
  const pages = pagesOf(spreads)
  const per = imp === "4up" ? 8 : imp === "2up" ? 4 : 1
  const sheets = Math.ceil(pages / per)
  const file = `${slug(title)}-${known ? preset : `${fmtN(book.w)}x${fmtN(book.h)}cm`}${imp !== "single" ? `-${imp}` : ""}.pdf`
  return (
    <AppModal isOpen width={500} onOpenChange={(o) => { if (!o && step !== "run") onClose() }} isDismissable={step !== "run"}>
      <div className="px-6 pb-5 pt-5" data-testid="print-dialog" data-step={step}>
        {step === "opts" && <>
          <div className="heading text-xl leading-tight">Print</div>
          <p className="mt-1 text-sm text-muted-foreground">A PDF for a print shop or a home duplex printer.</p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm" data-testid="print-size"><span className="text-muted-foreground">Page size</span><span className="tabular-nums">{known ? known.name : "Custom"} · {size}</span></div>
            <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Imposition (duplex)</span><Segmented label="Imposition" value={imp} onChange={setImp} items={[{ id: "single", label: "1 per sheet" }, { id: "2up", label: "2-up" }, { id: "4up", label: "4-up" }]} /></div>
            <Checkbox isSelected={bleed} onChange={setBleed}>Add 3 mm bleed and crop marks</Checkbox>
            <div className="text-xs text-muted-foreground" data-testid="print-summary">PDF · {pages} pages on {sheets} sheet{sheets > 1 ? "s" : ""}{imp !== "single" ? " printed both sides" : ""}{bleed ? " · bleed 3 mm" : ""}</div>
          </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="px-4" onPress={onClose}>Cancel</Button><Button size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => setStep("run")} data-testid="print-go">Export PDF</Button></div>
        </>}
        {step === "run" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><Loader2 className="size-5 animate-spin" />Exporting PDF…</div>
          <p className="mt-1 text-sm text-muted-foreground">{v < 60 ? "Rendering pages at 300 dpi" : "Imposing sheets"} · {v}%</p>
          <Progress aria-label="Exporting" value={v} className="mt-4" barClassName="h-1.5 bg-secondary" data-testid="print-progress" />
        </>}
        {step === "done" && <>
          <div className="heading flex items-center gap-2 text-xl leading-tight"><CircleCheck className="size-5" />PDF ready</div>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="print-done">{file} · {sheets} sheets</p>
          {shown && <p className="mt-2 text-xs text-muted-foreground" role="status">Shown in ~/Documents/Photobooks exports</p>}
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="md" className="gap-1.5 px-4 [&_svg]:size-4" onPress={() => setShown(true)} data-testid="print-show"><FolderOpen />Show in folder</Button><Button size="md" className="px-4" onPress={onClose} data-testid="print-close">Done</Button></div>
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
