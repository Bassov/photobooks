/* #/demo Settings: the settings screen (moved from features/screen-demos in Stage 3, unchanged except the optional initialSection) and its back bar. */
import * as React from "react"
import { ChevronLeft, HardDrive, FolderSync, Globe, Printer, KeyRound, Info, BookOpen, SlidersHorizontal, Plus, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@/components/ui/menu"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Badge } from "@/components/uui/Badge"
import { AlertDialog, IconButton } from "@/components/app/ui"
import { FolderPicker, LIBRARY } from "@/features/screens"
import { useSession } from "./session"
import { HostingSection, type HostingInit } from "./hosting"
import { CATALOG, GENERIC_ID, PrintProfileDialog, copyOf, newProfile, profileSummary, type Draft, type KitProfile } from "./printProfiles"

export type SettingsSection = "library" | "hosting" | "site" | "print" | "interface"
/* ---------------------------------------------------------------- settings */
const SECTIONS = [["library", "Library", HardDrive], ["hosting", "Hosting", KeyRound], ["site", "Site", Globe], ["print", "Print presets", Printer], ["interface", "Interface", SlidersHorizontal]] as const
export function SettingsScreen(props: { bookCount?: number; libraryPath?: string; initialSection?: SettingsSection; print?: PrintInit; hosting?: HostingInit } = {}) {
  const { bookCount, libraryPath, initialSection = "library", print, hosting } = props
  const [sec, setSec] = React.useState<string>(initialSection)
  const [path, setPath] = React.useState(libraryPath ?? LIBRARY.path)
  const [confirm, setConfirm] = React.useState(false)
  const [pick, setPick] = React.useState(false)
  const [prev, setPrev] = React.useState<string | null>(null)
  React.useEffect(() => { if (libraryPath) setPath(libraryPath) }, [libraryPath])
  const booksLive = bookCount ?? (path === LIBRARY.path ? LIBRARY.books : 0)
  const row = "flex min-h-13 items-center gap-4 px-4 py-2" // v0.9.1: no card border; tone via chrome surface only
  const rule = <div className="mx-4 h-px shrink-0" style={{ background: "rgb(0 0 0 / 0.06)" }} aria-hidden />
  return (
    <div className="grid h-full grid-cols-[220px_1fr] bg-background" data-testid="settings">
      <nav className="flex flex-col gap-0.5 border-r bg-chrome p-3">
        <div className="mb-3 flex items-center gap-2 px-2 pt-1"><div className="grid size-6 place-items-center rounded-md bg-field text-foreground"><BookOpen className="size-3" /></div><span className="text-base font-semibold">Settings</span></div>
        {SECTIONS.map(([id, l, I]) => (
          <button key={id} type="button" data-testid={`settings-nav-${id}`} aria-current={sec === id ? "page" : undefined} onClick={() => setSec(id)} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring", sec === id && "bg-accent font-medium")}><I className="size-4 text-muted-foreground" />{l}</button>
        ))}
      </nav>
      <main className="min-h-0 overflow-auto px-8 py-6">
        <h1 className="heading text-2xl">{SECTIONS.find((s) => s[0] === sec)![1]}</h1>
        {sec === "library" ? (
          <>
            <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">Photobooks keeps every book in one folder on your disk — your library. To use a different library, change the folder.</p>
            <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="library-settings">
              <div className={row}>
                <FeaturedIcon color="gray" theme="outline" size="md"><HardDrive /></FeaturedIcon>
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">Library folder</div><div className="truncate font-mono text-xs text-muted-foreground" data-testid="library-path">{path}</div></div>
                <Button variant="outline" size="sm" className="gap-1.5 px-3 text-sm shadow-xs [&_svg]:size-4" onPress={() => setConfirm(true)} data-testid="change-library"><FolderSync />Change library folder…</Button>
              </div>
              {rule}
              <div className={row}><div className="min-w-0 flex-1 text-sm">Books</div><span className="text-sm tabular-nums text-muted-foreground" data-testid="settings-book-count">{booksLive}</span></div>
              {rule}
              <div className={row}><div className="min-w-0 flex-1 text-sm">Folder access</div><Badge color="success" dot>Allowed · read and write</Badge></div>
              {rule}
              <div className={row}><div className="min-w-0 flex-1 text-sm">Preview cache<div className="text-xs text-muted-foreground">Rebuilt automatically if cleared</div></div><span className="text-sm tabular-nums text-muted-foreground">212 MB</span></div>
            </div>
            {prev && <div className="mt-4 flex max-w-[640px] items-center gap-2 rounded-lg bg-chrome px-4 py-2 text-sm" role="status" data-testid="library-changed"><Info className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1">Now using <b className="font-semibold">{path}</b>. Your books in <span className="font-mono text-xs">{prev}</span> were not moved.</span><Button variant="ghost" size="xs" className="px-3 text-xs" onPress={() => { setPath(prev); setPrev(null) }}>Switch back</Button></div>}
          </>
        ) : sec === "print" ? <PrintPresets row={row} rule={rule} init={print} /> : sec === "hosting" ? <HostingSection rule={rule} init={hosting} /> : (
          <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome">
            {(sec === "site" ? [["Site title", "Aleksandr’s photobooks"], ["Author", "Aleksandr Basov"]]
              : [["Units", "Millimetres"], ["Thumbnail size", "96 px"], ["Density", "Comfortable"]]).map(([k, v], i) => (
              <React.Fragment key={k}>
                {i > 0 && rule}
                <div className={row}><div className="min-w-0 flex-1 text-sm">{k}</div><span className="text-sm text-muted-foreground">{v}</span></div>
              </React.Fragment>
            ))}
          </div>
        )}
      </main>
      <AlertDialog isOpen={confirm} tone="neutral" icon={<FolderSync />} title="Change the library folder?" confirmLabel="Choose folder…" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); setPick(true) }}>
        Your books stay in <span className="font-mono text-sm text-foreground/80">{path}</span> — nothing is moved or deleted. Photobooks will show the books in the folder you pick instead (an empty folder starts a new library). Change it back any time to see these books again.
      </AlertDialog>
      <FolderPicker isOpen={pick} title="Choose the library folder" onCancel={() => setPick(false)} onPick={(p) => { setPick(false); if (p !== path) { setPrev(path); setPath(p) } }} />
    </div>
  )
}

/* ---------------------------------------------------------------- print presets (Designer spec printer-presets §Settings) */
/** feature-page seed: the editor open on a custom profile id, or on a new profile ("new"), with an optional draft */
export type PrintInit = { edit?: string; draft?: Partial<Draft> }
type Editing = { p: KitProfile; mode: "new" | "edit"; draft?: Partial<Draft> }
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23535152' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`
const SECONDARY = "gap-1.5 px-3 text-sm shadow-xs data-[hovered]:bg-accent [&_svg]:size-4"
const EYEBROW = "mt-6 flex h-8 max-w-[640px] items-center justify-between px-4"
const EYEBROW_T = "text-2xs font-semibold uppercase tracking-[.12em] text-muted-foreground"
function PrintPresets({ row, rule, init }: { row: string; rule: React.ReactNode; init?: PrintInit }) {
  const { set, useDemo } = useSession()
  const { printProfiles: customs, defaultPrintProfileId: def } = useDemo()
  const [editing, setEditing] = React.useState<Editing | null>(() => {
    if (!init?.edit) return null
    const p = init.edit === "new" ? newProfile() : customs.find((c) => c.id === init.edit)
    return p ? { p, mode: init.edit === "new" ? "new" : "edit", draft: init.draft } : null
  })
  const [deleting, setDeleting] = React.useState<KitProfile | null>(null)
  const duplicate = (p: KitProfile) => {
    const c = copyOf(p, [...CATALOG, ...customs].map((x) => x.name))
    set({ printProfiles: [...customs, c] }); setEditing({ p: c, mode: "edit" })
  }
  const save = (p: KitProfile) => { set({ printProfiles: customs.some((c) => c.id === p.id) ? customs.map((c) => (c.id === p.id ? p : c)) : [...customs, p] }); setEditing(null) }
  const remove = (p: KitProfile) => { set({ printProfiles: customs.filter((c) => c.id !== p.id), ...(def === p.id ? { defaultPrintProfileId: GENERIC_ID } : {}) }); setDeleting(null) }
  const item = (p: KitProfile, tid: string, right: React.ReactNode) => {
    const sum = profileSummary(p)
    return (
      <div className={row} data-testid={tid}>
        <div className="min-w-0 flex-1"><div className="text-sm font-medium">{p.name}</div><div className="truncate text-xs text-muted-foreground" title={sum} data-testid="print-summary-line">{sum}</div></div>
        {p.id === def && <Badge color="gray">Default</Badge>}
        {right}
      </div>
    )
  }
  const list = (ps: KitProfile[], f: (p: KitProfile) => React.ReactNode) => ps.map((p, i) => <React.Fragment key={p.id}>{i > 0 && rule}{f(p)}</React.Fragment>)
  return (
    <>
      <p className="mt-1 max-w-[560px] text-sm leading-relaxed text-muted-foreground">A print profile holds a printer’s rules: page sizes, bleed, safe margin, page count and spine. Each book uses one profile; new books start with the default.</p>
      <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome">
        <div className={row}>
          <div className="min-w-0 flex-1 text-sm">Default for new books</div>
          <select aria-label="Default for new books" data-testid="print-default" value={def} onChange={(e) => set({ defaultPrintProfileId: e.target.value })}
            className="h-8 w-[240px] shrink-0 appearance-none truncate rounded-md border-0 bg-field pl-2.5 pr-8 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]"
            style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "16px 16px" }}>
            <optgroup label="Print shops">{CATALOG.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
            {customs.length > 0 && <optgroup label="Custom">{customs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
          </select>
        </div>
      </div>
      <div className={EYEBROW}><h2 className={EYEBROW_T}>Print shops</h2></div>
      <div className="mt-2 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="print-shops">
        {list(CATALOG, (p) => item(p, `print-shop-${p.id}`, <Button variant="outline" size="sm" className={SECONDARY} onPress={() => duplicate(p)} data-testid={`print-duplicate-${p.id}`}>Duplicate</Button>))}
      </div>
      <div className={EYEBROW}><h2 className={EYEBROW_T}>Custom</h2>
        <Button variant="outline" size="sm" className={SECONDARY} onPress={() => setEditing({ p: newProfile(), mode: "new" })} data-testid="print-new"><Plus />New profile</Button></div>
      <div className="mt-2 max-w-[640px] overflow-hidden rounded-xl bg-chrome" data-testid="print-custom">
        {customs.length === 0
          ? <div className={cn(row, "text-sm text-muted-foreground")} data-testid="print-custom-empty">No custom profiles yet. Duplicate a print shop’s profile, or start a new one.</div>
          : list(customs, (p) => item(p, `print-custom-${p.id}`, <>
            <Button variant="outline" size="sm" className={SECONDARY} onPress={() => setEditing({ p, mode: "edit" })} data-testid={`print-edit-${p.id}`}>Edit…</Button>
            <MenuTrigger>
              <IconButton label="More" size="sm" tooltip={false} className="rounded-md data-[hovered]:bg-field" data-testid={`print-more-${p.id}`}><MoreHorizontal /></IconButton>
              <MenuPopover placement="bottom end" className="w-44">
                <Menu onAction={(k) => { if (k === "dup") duplicate(p); if (k === "rm") setDeleting(p) }} data-testid="print-menu">
                  <MenuItem id="dup">Duplicate</MenuItem>
                  <MenuItem id="rm" style={{ color: "#a8403a" }}>Delete…</MenuItem>
                </Menu>
              </MenuPopover>
            </MenuTrigger>
          </>))}
      </div>
      {editing && <PrintProfileDialog key={editing.p.id} profile={editing.p} mode={editing.mode} initialDraft={editing.draft} onSave={save} onCancel={() => setEditing(null)} />}
      <AlertDialog isOpen={!!deleting} tone="destructive" title={`Delete “${deleting?.name ?? ""}”?`} confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={() => deleting && remove(deleting)}>
        Books that use it keep its values.{deleting?.id === def && " New books will start with Generic."}
      </AlertDialog>
    </>
  )
}

/** #/demo Settings stage with its back bar ("Back to the book" from the editor, "Library" from the library). State: session (back, books, path). */
export function DemoSettings({ initialSection, print, hosting }: { initialSection?: SettingsSection; print?: PrintInit; hosting?: HostingInit } = {}) {
  const { set, useDemo } = useSession()
  const d = useDemo()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 bg-chrome px-3"><Button variant="ghost" size="sm" className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" onPress={() => set({ stage: d.back })} data-testid="demo-settings-back"><ChevronLeft />{d.back === "editor" ? "Back to the book" : "Library"}</Button><span className="text-sm font-medium">Settings</span></div>
      <div className="min-h-0 flex-1"><SettingsScreen bookCount={d.books.length} libraryPath={d.path || undefined} initialSection={initialSection} print={print} hosting={hosting} /></div>
    </div>
  )
}
