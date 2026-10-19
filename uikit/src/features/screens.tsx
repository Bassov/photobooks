/* Shared product screens for feature pages: Home (libraries + books), fake folder picker, relink dialog. */
import * as React from "react"
import {
  BookOpen, Plus, FolderOpen, MoreHorizontal, Clock, HardDrive, Search, Pencil, Copy, Trash2, Check, ImageOff,
  CircleCheck, FolderSearch, AlertTriangle, Loader2, Folder, ChevronRight, Sparkles, Settings, Moon,
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

export type BookCard = { id: string; title: string; cover: string; spreads: number; edited: string; status?: "draft" | "published" }
export const BOOKS: BookCard[] = [
  { id: "b1", title: "Summer by the sea", cover: "p16", spreads: 8, edited: "2 hours ago", status: "published" },
  { id: "b2", title: "Mountains, July", cover: "p01", spreads: 18, edited: "Yesterday" },
  { id: "b3", title: "Family album 2025", cover: "p15", spreads: 24, edited: "Oct 2" },
  { id: "b4", title: "Road trip west", cover: "p08", spreads: 12, edited: "Sep 28" },
  { id: "b5", title: "Forest walks", cover: "p10", spreads: 10, edited: "Sep 14" },
  { id: "b6", title: "Vineyards & coffee", cover: "p06", spreads: 6, edited: "Aug 30" },
]
export const LIBRARIES = [
  { id: "l1", name: "Photobooks", path: "~/Pictures/Photobooks", books: 6, when: "Today" },
  { id: "l2", name: "Family archive", path: "/Volumes/Archive/Family", books: 3, when: "Last week", offline: true },
]

export function DialogHead({ title, sub, icon }: { title: string; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-6 pb-4 pt-5">
      {icon}
      <div className="min-w-0 flex-1">
        <Heading slot="title" className="heading text-[19px] leading-tight">{title}</Heading>
        {sub && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

export function HomeScreen({ empty = false, onOpenBook, banner, extraNav }: { empty?: boolean; onOpenBook?: (b: BookCard) => void; banner?: React.ReactNode; extraNav?: React.ReactNode }) {
  const [books, setBooks] = React.useState<BookCard[]>(empty ? [] : BOOKS)
  const [lib, setLib] = React.useState("l1")
  const [creating, setCreating] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<BookCard | null>(null)
  const lastRemoving = React.useRef<BookCard | null>(null) // keeps the title during the close animation
  if (removing) lastRemoving.current = removing
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState("recent")
  let shown = books.filter((b) => b.title.toLowerCase().includes(q.toLowerCase()))
  if (sort === "title") shown = [...shown].sort((a, b) => a.title.localeCompare(b.title))
  const create = () => {
    const t = title.trim() || "Untitled book"
    setBooks((b) => [{ id: `n${Date.now()}`, title: t, cover: "", spreads: 1, edited: "Just now" }, ...b]); setCreating(false); setTitle("")
  }
  return (
    <div className="grid h-full grid-cols-[220px_1fr] bg-background" data-testid="home">
      <nav className="flex flex-col gap-1 border-r bg-chrome p-3">
        <div className="mb-3 flex items-center gap-2 px-1.5 pt-1"><div className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground"><BookOpen className="size-3" /></div><span className="text-[14px] font-semibold">Photobooks</span></div>
        <div className="eyebrow px-2 pb-1">Recent libraries</div>
        {LIBRARIES.map((l) => (
          <button key={l.id} type="button" onClick={() => setLib(l.id)} className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-hidden hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring", lib === l.id && "bg-accent")}>
            <HardDrive className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0"><span className="block truncate font-medium">{l.name}</span><span className="block truncate text-[11px] text-muted-foreground">{l.offline ? "Drive not connected" : `${l.books} books · ${l.when}`}</span></span>
          </button>
        ))}
        <Button variant="ghost" size="sm" className="mt-1 h-8 justify-start gap-2 px-2 text-[13px] text-muted-foreground [&_svg]:size-4"><FolderOpen />Open library folder…</Button>
        {extraNav}
        <div className="mt-auto flex items-center gap-1 px-1 text-xs text-muted-foreground"><Settings className="size-3.5" />Settings<span className="ml-auto"><Moon className="size-3.5" /></span></div>
      </nav>
      <main className="min-h-0 overflow-auto px-8 py-6">
        {banner}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1"><h1 className="heading text-[24px]">{LIBRARIES.find((l) => l.id === lib)!.name}</h1><div className="text-xs text-muted-foreground">{LIBRARIES.find((l) => l.id === lib)!.path} · {books.length} books</div></div>
          {!empty || books.length ? (
            <>
              <SearchField aria-label="Search books" value={q} onChange={setQ} className="w-52"><SearchFieldGroup className="h-8 gap-1.5 px-2.5 py-0 shadow-xs"><Search className="size-3.5 text-muted-foreground" /><SearchFieldInput placeholder="Search books" className="bg-transparent px-0 py-0 text-[13px]" /></SearchFieldGroup></SearchField>
              <Tabs selectedKey={sort} onSelectionChange={(k) => setSort(String(k))}><TabList aria-label="Sort"><Tab id="recent">Recent</Tab><Tab id="title">A–Z</Tab></TabList></Tabs>
            </>
          ) : null}
          <Button size="sm" className="h-8 gap-1.5 px-3 text-[13px] shadow-sm [&_svg]:size-4" onPress={() => setCreating(true)} data-testid="new-book"><Plus />New book</Button>
        </div>
        {books.length === 0 ? (
          <div className="mx-auto mt-16 flex max-w-[420px] flex-col items-center text-center" data-testid="home-empty">
            <FeaturedIcon size="xl" theme="outline" className="mb-6"><BookOpen /></FeaturedIcon>
            <div className="heading text-xl">No books in this library yet</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">A library is a folder on your disk. Books, previews and settings live there — nothing is uploaded.</p>
            <div className="mt-5 flex gap-2"><Button size="sm" className="h-9 gap-1.5 px-3.5 shadow-sm [&_svg]:size-4" onPress={() => setCreating(true)}><Plus />New book</Button><Button variant="outline" size="sm" className="h-9 gap-1.5 px-3.5 shadow-xs [&_svg]:size-4"><Sparkles />Open sample book</Button></div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
            {shown.map((b) => (
              <div key={b.id} className="group flex flex-col gap-2" data-testid="book-card">
                <button type="button" onClick={() => onOpenBook?.(b)} className="relative aspect-[2/1] overflow-hidden rounded-lg bg-paper shadow-[0_1px_2px_rgb(0_0_0/.08),0_6px_18px_rgb(0_0_0/.06)] outline-hidden ring-offset-2 ring-offset-background transition-shadow hover:shadow-[0_2px_4px_rgb(0_0_0/.1),0_12px_28px_rgb(0_0_0/.1)] focus-visible:ring-2 focus-visible:ring-ring">
                  {b.cover ? <img src={P(b.cover).src} alt="" className="absolute right-0 top-0 h-full w-1/2 object-cover" /> : <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">Empty book</div>}
                  <div className="absolute inset-y-0 left-1/2 w-[3%] -translate-x-1/2 bg-gradient-to-r from-transparent via-black/[0.07] to-transparent" />
                  {b.cover && <span className="absolute left-[8%] top-1/2 max-w-[38%] -translate-y-1/2 text-left font-[Lora_Variable,serif] text-[13px] leading-tight text-neutral-800">{b.title}</span>}
                </button>
                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    {renaming === b.id ? (
                      <TextField aria-label="Book title" defaultValue={b.title} autoFocus onKeyDown={(e) => { if (e.key === "Enter") { setBooks((x) => x.map((y) => (y.id === b.id ? { ...y, title: (e.target as HTMLInputElement).value || y.title } : y))); setRenaming(null) } if (e.key === "Escape") setRenaming(null) }}
                        onBlur={(e) => { setBooks((x) => x.map((y) => (y.id === b.id ? { ...y, title: (e.target as HTMLInputElement).value || y.title } : y))); setRenaming(null) }}>
                        <Input className="h-7 px-2 text-[13px]" data-testid="rename-input" />
                      </TextField>
                    ) : <div className="truncate text-[13.5px] font-medium" onDoubleClick={() => setRenaming(b.id)}>{b.title}</div>}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" />{b.edited} · {b.spreads} spreads{b.status === "published" && <Badge color="success" className="ml-1" dot>Published</Badge>}</div>
                  </div>
                  <MenuTrigger>
                    <IconButton label="Book actions" size="sm" tooltip={false} className="opacity-60 group-hover:opacity-100"><MoreHorizontal /></IconButton>
                    <MenuPopover placement="bottom end" className="w-44">
                      <Menu className="[&_svg]:size-4 [&_svg]:text-muted-foreground" onAction={(k) => { if (k === "rename") setRenaming(b.id); if (k === "dup") setBooks((x) => [{ ...b, id: `d${Date.now()}`, title: `${b.title} (copy)`, edited: "Just now" }, ...x]); if (k === "rm") setRemoving(b) }}>
                        <MenuItem id="open" onAction={() => onOpenBook?.(b)}><FolderOpen />Open</MenuItem>
                        <MenuItem id="rename"><Pencil />Rename</MenuItem><MenuItem id="dup"><Copy />Duplicate</MenuItem>
                        <MenuSeparator /><MenuItem id="rm" variant="destructive"><Trash2 />Remove…</MenuItem>
                      </Menu>
                    </MenuPopover>
                  </MenuTrigger>
                </div>
              </div>
            ))}
            {shown.length === 0 && <div className="col-span-full py-10 text-center text-[13px] text-muted-foreground">Nothing matches “{q}”.</div>}
          </div>
        )}
      </main>
      <AppModal isOpen={creating} width={440}>
        <DialogHead title="New book" sub="Give it a title — you can change it later." />
        <div className="px-6 pb-2"><JollyTextField label="Title" value={title} onChange={setTitle} autoFocus className="[&_input]:h-9 [&_label]:text-xs [&_label]:font-normal [&_label]:text-muted-foreground" onKeyDown={(e) => { if (e.key === "Enter") create() }} /></div>
        <div className="flex justify-end gap-2 border-t px-6 py-3.5"><Button variant="outline" size="sm" className="h-9 px-4 shadow-xs" onPress={() => setCreating(false)}>Cancel</Button><Button size="sm" className="h-9 px-4 shadow-sm" onPress={create} data-testid="create-book">Create book</Button></div>
      </AppModal>
      <AlertDialog isOpen={!!removing} title={<>Remove “{(removing ?? lastRemoving.current)?.title}”?</>} confirmLabel="Remove book"
        onCancel={() => setRemoving(null)} onConfirm={() => { setBooks((x) => x.filter((y) => y.id !== removing!.id)); setRemoving(null) }}>
        The book disappears from this library. Photos stay on disk, untouched.
      </AlertDialog>
    </div>
  )
}

/* Fake system folder picker — stands in for showDirectoryPicker() */
export function FolderPicker({ isOpen, onPick, onCancel, title = "Choose a library folder" }: { isOpen: boolean; onPick: (path: string) => void; onCancel: () => void; title?: string }) {
  const [sel, setSel] = React.useState("Photobooks")
  const folders = ["Photobooks", "Summer 2025", "Mountains", "Family", "Exports"]
  return (
    <AppModal isOpen={isOpen} width={560}>
      <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2 text-xs text-muted-foreground dark:bg-black/20"><span className="flex gap-1.5"><span className="size-2.5 rounded-full bg-[#ec6a5e]" /><span className="size-2.5 rounded-full bg-[#f4bf4f]" /><span className="size-2.5 rounded-full bg-[#61c554]" /></span><span className="mx-auto">{title} · system dialog (emulated)</span></div>
      <div className="grid grid-cols-[150px_1fr]">
        <div className="border-r p-2 text-[13px]">{["Pictures", "Desktop", "Documents"].map((x, i) => <div key={x} className={cn("rounded px-2 py-1", i === 0 && "bg-accent")}>{x}</div>)}</div>
        <div className="p-2">{folders.map((f) => <button key={f} type="button" onClick={() => setSel(f)} onDoubleClick={() => onPick(`~/Pictures/${f}`)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]", sel === f && "bg-select text-white")}><Folder className="size-4" />{f}<ChevronRight className="ml-auto size-3.5 opacity-50" /></button>)}</div>
      </div>
      <div className="flex justify-end gap-2 border-t px-4 py-3"><Button variant="outline" size="sm" className="h-8 px-3 text-[13px]" onPress={onCancel}>Cancel</Button><Button size="sm" className="h-8 px-3 text-[13px]" onPress={() => onPick(`~/Pictures/${sel}`)} data-testid="picker-select">Select “{sel}”</Button></div>
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
// eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (isOpen) { setRows(rows0); setScan(-1) } }, [isOpen])
  const rescan = () => {
    setScan(0); let i = 0
    const t = setInterval(() => { i += 5; setScan(i); if (i >= 100) { clearInterval(t); setScan(-1); setRows((r) => r.map((x) => (x.status === "missing" ? { ...x, found: true, note: "Found by hash in ~/Pictures/Summer 2025/beach" } : x))) } }, 70)
  }
  const fixed = rows.filter((r) => r.status === "ok" || r.found)
  const problems = rows.filter((r) => r.status !== "ok")
  const shown = tab === "problems" ? problems : rows
  const rb = "h-8 gap-1.5 px-3 text-[13px] shadow-xs [&_svg]:size-4"
  return (
    <AppModal isOpen={isOpen} width={760}>
      <DialogHead icon={<FeaturedIcon color="warning" size="md" className="mt-0.5"><AlertTriangle /></FeaturedIcon>}
        title={`${problems.filter((r) => !r.found).length || "No"} photos need attention`} sub="They were moved, renamed or edited since the last save. The book stays editable — missing frames show a placeholder and export waits until they are resolved." />
      <div className="flex items-center gap-3 px-6">
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}><TabList aria-label="Filter" className="w-max"><Tab id="problems">Needs attention<TabCount>{problems.length}</TabCount></Tab><Tab id="all">All<TabCount>{rows.length}</TabCount></Tab></TabList></Tabs>
        {scan >= 0 && <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Hashing in worker · {scan}%<Progress aria-label="Rescan" value={scan} className="w-28" barClassName="h-1 bg-secondary dark:bg-accent" /></div>}
      </div>
      <div className="mx-6 mt-3.5 max-h-[300px] overflow-auto rounded-lg border">
        {shown.map((r) => {
          const p = P(r.id)
          return (
            <div key={r.id} className="grid grid-cols-[44px_1fr_100px_150px] items-center gap-4 border-b px-4 py-2.5 last:border-b-0" data-testid="relink-row">
              {r.status === "missing" && !r.found ? <div className="grid size-11 place-items-center rounded-md border border-dashed text-muted-foreground"><ImageOff className="size-4" /></div> : <img src={p.src} alt="" className="size-11 rounded-md object-cover" />}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{p.name}</div>
                <div className={cn("truncate text-xs", r.found ? "text-success" : "text-muted-foreground")}>{r.found && <Check className="mr-1 inline size-3.5" />}{r.note ?? r.folder}</div>
              </div>
              <div>{r.status === "ok" ? <Badge color="success" dot>Linked</Badge> : r.found ? <Badge color="success" icon={<CircleCheck />}>Found</Badge> : r.status === "missing" ? <Badge color="error" dot>Missing</Badge> : <Badge color="warning" dot>Modified</Badge>}</div>
              <div className="flex justify-end">
                {r.status === "missing" && !r.found && <Button variant="outline" size="sm" className={rb} onPress={() => setPicker(r.id)}><FolderSearch />Locate…</Button>}
                {r.status === "modified" && <Button variant="outline" size="sm" className={rb} onPress={() => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, status: "ok", note: "Updated · crop kept" } : y)))}>Use new version</Button>}
              </div>
            </div>
          )
        })}
        {shown.length === 0 && <div className="p-6 text-center text-[13px] text-muted-foreground">Everything is linked.</div>}
      </div>
      <div className="mt-5 flex items-center gap-2 border-t bg-muted/40 px-6 py-3.5 dark:bg-black/15">
        <div className="mr-auto [&_label]:text-[13px] [&_label]:font-normal"><Checkbox defaultSelected>Search the whole library folder</Checkbox></div>
        <Button variant="ghost" size="sm" className="h-9 px-3" onPress={onClose}>Skip for now</Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3.5 shadow-xs [&_svg]:size-4" onPress={rescan} isDisabled={scan >= 0} data-testid="rescan">{scan >= 0 ? <Loader2 className="animate-spin" /> : <FolderSearch />}Rescan folder…</Button>
        <Button size="sm" className="h-9 px-4 shadow-sm" isDisabled={!fixed.filter((r) => r.found || r.note?.startsWith("Updated")).length} onPress={() => onResolve(rows.filter((r) => r.found || r.status === "ok").map((r) => r.id))} data-testid="resolve">Resolve {fixed.filter((r) => r.found || r.note?.startsWith("Updated")).length || ""}</Button>
      </div>
      <FolderPicker isOpen={!!picker} title="Locate the missing photo" onCancel={() => setPicker(null)} onPick={() => { setRows((x) => x.map((y) => (y.id === picker ? { ...y, found: true, note: "Located manually · hash matches" } : y))); setPicker(null) }} />
    </AppModal>
  )
}
export { Kbd }
