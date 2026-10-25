/* Shared Create book dialog — title + Page size (presets + Custom). Used by #/demo and full library. */
import * as React from "react"
import { Button } from "@/components/ui/button"
import { JollyTextField } from "@/components/ui/textfield"
import { Segmented, SelectRow } from "@/components/app/controls"
import { AppModal } from "@/components/app/ui"
import { BOOK0, type Book } from "@/sandbox/store"
import { PRESETS, presetLabel, fmtN } from "@/sandbox/v7"

export function CreateBookDialog({ isOpen, onCancel, onCreate }: { isOpen: boolean; onCancel: () => void; onCreate: (title: string, b: Book) => void }) {
  const [title, setTitle] = React.useState("")
  const [preset, setPreset] = React.useState("A5")
  const [land, setLand] = React.useState("portrait")
  const [cw, setCw] = React.useState(18), [ch, setCh] = React.useState(24)
  const custom = preset === "custom"
  const p = custom ? { id: "custom", name: "Custom", w: cw, h: ch } : PRESETS.find((x) => x.id === preset)!
  const cl = (n: number) => Math.min(42, Math.max(10, Math.round(n * 10) / 10))
  const go = () => {
    if (custom) { onCreate(title.trim() || "Untitled book", { ...BOOK0, preset: "custom", w: cl(cw), h: cl(ch) }); setTitle(""); return }
    const l = !custom && land === "landscape" && p.w !== p.h
    onCreate(title.trim() || "Untitled book", { ...BOOK0, preset, w: l ? p.h : p.w, h: l ? p.w : p.h })
    setTitle("")
  }
  return (
    <AppModal isOpen={isOpen} width={460} onOpenChange={(o) => { if (!o) onCancel() }}>
      <div className="px-6 pb-3 pt-5" data-testid="create-book-dialog"><div className="heading text-xl leading-tight">Create book</div><p className="mt-1 text-sm text-muted-foreground">A title and a page size — both can change later.</p></div>
      <div className="flex flex-col gap-3 px-6 pb-2">
        <JollyTextField label="Title" value={title} onChange={setTitle} autoFocus className="[&_input]:h-9 [&_label]:text-xs [&_label]:font-normal [&_label]:text-muted-foreground" onKeyDown={(e) => { if (e.key === "Enter") go() }} data-testid="create-title" />
        <SelectRow label="Page size" value={preset} onChange={setPreset} items={[...PRESETS.map((x) => [x.id, presetLabel(x, land === "landscape")] as [string, string]), ["custom", "Custom size…"]]} />
        {custom && <div className="grid grid-cols-2 gap-2" data-testid="create-custom">
          {([["Width", cw, setCw], ["Height", ch, setCh]] as const).map(([l, v, sv]) => <label key={l} className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">{l} (cm)</span>
            <input type="number" inputMode="decimal" min={10} max={42} step={0.1} value={v} aria-label={`${l} (cm)`} data-testid={`create-custom-${l === "Width" ? "w" : "h"}`} onChange={(e) => { const n = +e.target.value; if (Number.isFinite(n) && n > 0) sv(n) }} onBlur={() => sv(cl(v))}
              className="h-9 rounded-md bg-field px-2.5 text-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-[#535152]" /></label>)}
          <p className="col-span-2 text-xs text-muted-foreground">10–42 cm per side · {fmtN(cl(cw))} × {fmtN(cl(ch))} cm</p></div>}
        {!custom && p.w !== p.h && <div className="flex flex-col gap-1.5"><span className="text-xs text-muted-foreground">Orientation</span><Segmented label="Orientation" value={land} onChange={setLand} items={[{ id: "portrait", label: "Portrait" }, { id: "landscape", label: "Landscape" }]} /></div>}
        <p className="text-xs text-muted-foreground">Size of one page. To print 2 pages per A4 sheet, choose A5.</p>
      </div>
      <div className="flex justify-end gap-2 px-6 pb-5 pt-3"><Button variant="ghost" size="md" className="px-4" onPress={onCancel}>Cancel</Button><Button size="md" className="px-4" onPress={go} data-testid="create-book">Create book</Button></div>
    </AppModal>
  )
}
