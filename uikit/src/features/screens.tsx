/* Shared product screens for feature pages: Home (the one library + its books), library-folder change, fake folder picker, relink dialog. */
import * as React from "react"
import {
  BookOpen, Plus, FolderOpen, MoreHorizontal, Clock, HardDrive, Search, Pencil, Copy, Trash2, Check, ImageOff,
  CircleCheck, FolderSearch, AlertTriangle, Loader2, Folder, ChevronRight, Sparkles, Settings, FolderSync, Info,
} from "lucide-react"
import { Heading } from "react-aria-components"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MenuTrigger, MenuPopover, Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { TextField, Input } from "@/components/ui/textfield"
import { JollyTextField } from "@/components/ui/textfield"
import { SearchField, SearchFieldGroup, SearchFieldInput } from "@/components/ui/searchfield"
import { Tabs, TabList, Tab, TabCount } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/uui/Badge"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { AppModal, AlertDialog, IconButton, Kbd } from "@/components/app/ui"
import { P } from "@/data"

export type BookCard = { id: string; title: string; cover: string; spreads: number; edited: string; status?: "draft" | "published"; format?: "portrait" | "landscape" | "square" }
export const BOOKS: BookCard[] = [
  { id: "b1", title: "Summer by the sea", cover: "p16", spreads: 10, edited: "2 hours ago", status: "published", format: "landscape" },
  { id: "b2", title: "Mountains, July", cover: "p01", spreads: 18, edited: "Yesterday", format: "portrait" },
  { id: "b3", title: "Family album 2025", cover: "p15", spreads: 24, edited: "Oct 2" },
  { id: "b4", title: "Road trip west", cover: "p08", spreads: 12, edited: "Sep 28", format: "square" },
  { id: "b5", title: "Forest walks", cover: "p10", spreads: 10, edited: "Sep 14" },
  { id: "b6", title: "Vineyards & coffee", cover: "p06", spreads: 11, edited: "Aug 30", format: "landscape" },
  /* designer-proto: New book tile + 9 books = two full rows of 5 at 1440 */
  { id: "b7", title: "City weekend", cover: "p02", spreads: 12, edited: "Aug 12" },
  { id: "b8", title: "Lake house", cover: "p03", spreads: 14, edited: "Jul 30" },
  { id: "b10", title: "Winter in the hills", cover: "p12", spreads: 11, edited: "Feb 2", format: "square" },
]
/** v4: exactly one library. The user picks one folder; to use another library they change the library folder. */
export const LIBRARY = { name: "Photobooks", path: "~/Pictures/Photobooks", books: 10 }
/** Books found in other folders the demo picker can switch to (only used after “Change library folder…”). */
const OTHER_FOLDERS: Record<string, BookCard[]> = {
  "~/Pictures/Family": [{ id: "f1", title: "Grandma’s 80th", cover: "p15", spreads: 14, edited: "Mar 3" }, { id: "f2", title: "Kids 2024", cover: "p19", spreads: 20, edited: "Jan 12" }],
}

export function DialogHead({ title, sub, icon }: { title: string; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-6 pb-4 pt-5">
      {icon}
      <div className="min-w-0 flex-1">
        <Heading slot="title" className="heading text-xl leading-tight">{title}</Heading>
        {sub && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

/* v6: Home is the library screen in ./library (re-exported for older imports). */
export { HomeScreen } from "./library"

/* Fake system folder picker — stands in for showDirectoryPicker() */
export function FolderPicker({ isOpen, onPick, onCancel, title = "Choose a library folder" }: { isOpen: boolean; onPick: (path: string) => void; onCancel: () => void; title?: string }) {
  const [sel, setSel] = React.useState("Photobooks")
  const folders = ["Photobooks", "Summer 2025", "Mountains", "Family", "Exports"]
  return (
    <AppModal isOpen={isOpen} width={560}>
      <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2 text-xs text-muted-foreground"><span className="flex gap-1.5"><span className="size-2.5 rounded-full bg-[#bdbdbd]" /><span className="size-2.5 rounded-full bg-[#bdbdbd]" /><span className="size-2.5 rounded-full bg-[#bdbdbd]" /></span><span className="mx-auto">{title}</span></div>
      <div className="grid grid-cols-[150px_1fr]">
        <div className="border-r p-2 text-sm">{["Pictures", "Desktop", "Documents"].map((x, i) => <div key={x} className={cn("rounded px-2 py-1", i === 0 && "bg-accent")}>{x}</div>)}</div>
        <div className="p-2">{folders.map((f) => <button key={f} type="button" onClick={() => setSel(f)} onDoubleClick={() => onPick(`~/Pictures/${f}`)} className={cn("flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm", sel === f && "bg-sel font-semibold text-foreground")}><Folder className="size-4" />{f}<ChevronRight className="ml-auto size-3.5 opacity-50" /></button>)}</div>
      </div>
      <div className="flex justify-end gap-2 border-t px-4 py-3"><Button variant="outline" size="sm" className="px-3 text-sm" onPress={onCancel}>Cancel</Button><Button size="sm" className="px-3 text-sm" onPress={() => onPick(`~/Pictures/${sel}`)} data-testid="picker-select">Select “{sel}”</Button></div>
    </AppModal>
  )
}

/* Missing / modified assets dialog with a real rescan simulation */
export type RelinkRow = { id: string; status: "missing" | "modified" | "ok"; folder: string; note?: string; found?: boolean }
export function RelinkDialog({ isOpen, onClose, onResolve, rows: rows0 }: { isOpen: boolean; onClose: () => void; onResolve: (ids: string[]) => void; rows: RelinkRow[] }) {
  const [rows, setRows] = React.useState(rows0)
  const [scan, setScan] = React.useState(-1)
  const [tab, setTab] = React.useState("problems")
  const [picker, setPicker] = React.useState<string | null>(null)
  React.useEffect(() => { if (isOpen) { setRows(rows0); setScan(-1) } }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  const rescan = () => {
    setScan(0); let i = 0
    const t = setInterval(() => { i += 5; setScan(i); if (i >= 100) { clearInterval(t); setScan(-1); setRows((r) => r.map((x) => (x.status === "missing" ? { ...x, found: true, note: "Found by hash in ~/Pictures/Summer 2025/beach" } : x))) } }, 70)
  }
  const fixed = rows.filter((r) => r.status === "ok" || r.found)
  const problems = rows.filter((r) => r.status !== "ok")
  const shown = tab === "problems" ? problems : rows
  const rb = "h-8 gap-1.5 px-3 text-sm shadow-xs [&_svg]:size-4"
  return (
    <AppModal isOpen={isOpen} width={760}>
      <DialogHead icon={<FeaturedIcon color="warning" size="md" className="mt-0.5"><AlertTriangle /></FeaturedIcon>}
        title={`${problems.filter((r) => !r.found).length || "No"} photos need attention`} sub="They were moved, renamed or edited since the last save. The book stays editable — missing frames show a placeholder and export waits until they are resolved." />
      <div className="flex items-center gap-3 px-6">
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}><TabList aria-label="Filter" className="w-max"><Tab id="problems">Needs attention<TabCount>{problems.length}</TabCount></Tab><Tab id="all">All<TabCount>{rows.length}</TabCount></Tab></TabList></Tabs>
        {scan >= 0 && <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Hashing in worker · {scan}%<Progress aria-label="Rescan" value={scan} className="w-28" barClassName="h-1 bg-secondary" /></div>}
      </div>
      <div className="mx-6 mt-3 max-h-[300px] overflow-auto rounded-lg border">
        {shown.map((r) => {
          const p = P(r.id)
          return (
            <div key={r.id} className="grid grid-cols-[44px_1fr_100px_150px] items-center gap-4 border-b px-4 py-2 last:border-b-0" data-testid="relink-row">
              {r.status === "missing" && !r.found ? <div className="grid size-11 place-items-center rounded-md border border-dashed text-muted-foreground"><ImageOff className="size-4" /></div> : <img src={p.src} alt="" className="size-11 rounded-md object-cover" />}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className={cn("truncate text-xs", r.found ? "text-success-fg" : "text-muted-foreground")}>{r.found && <Check className="mr-1 inline size-3.5" />}{r.note ?? r.folder}</div>
              </div>
              <div>{r.status === "ok" ? <Badge color="success" dot>Linked</Badge> : r.found ? <Badge color="success" icon={<CircleCheck />}>Found</Badge> : r.status === "missing" ? <Badge color="error" dot>Missing</Badge> : <Badge color="warning" dot>Modified</Badge>}</div>
              <div className="flex justify-end">
                {r.status === "missing" && !r.found && <Button variant="outline" size="md" className={rb} onPress={() => setPicker(r.id)}><FolderSearch />Locate folder…</Button>}
                {r.status === "modified" && <Button variant="outline" size="md" className={rb} onPress={() => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, status: "ok", note: "Updated · crop kept" } : y)))}>Use new version</Button>}
              </div>
            </div>
          )
        })}
        {shown.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Everything is linked.</div>}
      </div>
      <div className="mt-5 flex items-center gap-2 border-t bg-muted/40 px-6 py-3">
        <div className="mr-auto [&_label]:text-sm [&_label]:font-normal"><Checkbox defaultSelected>Also search next to the photo folder</Checkbox></div>
        <Button variant="ghost" size="md" className="px-3" onPress={onClose}>Skip for now</Button>
        <Button variant="outline" size="md" className="gap-1.5 px-4 shadow-xs [&_svg]:size-4" onPress={rescan} isDisabled={scan >= 0} data-testid="rescan">{scan >= 0 ? <Loader2 className="animate-spin" /> : <FolderSearch />}Rescan folder…</Button>
        <Button size="md" className="px-4 shadow-sm" isDisabled={!fixed.filter((r) => r.found || r.note?.startsWith("Updated")).length} disabledReason="Relink or locate at least one photo first" onPress={() => onResolve(rows.filter((r) => r.found || r.status === "ok").map((r) => r.id))} data-testid="resolve">Resolve {fixed.filter((r) => r.found || r.note?.startsWith("Updated")).length || ""}</Button>
      </div>
      <FolderPicker isOpen={!!picker} title="Locate the folder with the missing photo" onCancel={() => setPicker(null)} onPick={() => { setRows((x) => x.map((y) => (y.id === picker ? { ...y, found: true, note: "Folder located · hash matches" } : y))); setPicker(null) }} />
    </AppModal>
  )
}
export { Kbd }
