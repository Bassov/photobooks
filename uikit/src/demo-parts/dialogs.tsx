import * as React from "react"
import { CircleCheck, Loader2, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Segmented, SelectRow } from "@/components/app/controls"
import { AppModal } from "@/components/app/ui"
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
