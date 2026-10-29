/* #/demo Settings: the settings screen (moved from features/screen-demos in Stage 3, unchanged except the optional initialSection) and its back bar. */
import * as React from "react"
import { ChevronLeft, HardDrive, FolderSync, Globe, Printer, KeyRound, Info, BookOpen, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FeaturedIcon } from "@/components/uui/FeaturedIcon"
import { Badge } from "@/components/uui/Badge"
import { AlertDialog } from "@/components/app/ui"
import { FolderPicker, LIBRARY } from "@/features/screens"
import { useSession } from "./session"

export type SettingsSection = "library" | "hosting" | "site" | "print" | "interface"
/* ---------------------------------------------------------------- settings */
const SECTIONS = [["library", "Library", HardDrive], ["hosting", "Hosting", KeyRound], ["site", "Site", Globe], ["print", "Print presets", Printer], ["interface", "Interface", SlidersHorizontal]] as const
export function SettingsScreen(props: { bookCount?: number; libraryPath?: string; initialSection?: SettingsSection } = {}) {
  const { bookCount, libraryPath, initialSection = "library" } = props
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
          <button key={id} type="button" aria-current={sec === id ? "page" : undefined} onClick={() => setSec(id)} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring", sec === id && "bg-accent font-medium")}><I className="size-4 text-muted-foreground" />{l}</button>
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
        ) : (
          <div className="mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome">
            {(sec === "hosting" ? [["Provider", "Cloudflare R2 + Pages"], ["Account", "aleksandr.photos"], ["Token", "Scoped to one bucket · stored on this computer"]]
              : sec === "site" ? [["Site title", "Aleksandr’s photobooks"], ["Author", "Aleksandr Basov"]]
              : sec === "print" ? [["Default profile", "Saal Digital · 30×30 layflat"], ["Custom profiles", "2"], ["Home printer", "A4 duplex · short edge"]]
              : [["Units", "Millimetres"], ["Thumbnail size", "96 px"], ["Density", "Comfortable"]]).map(([k, v], i, arr) => (
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

/* ---------------------------------------------------------------- unsupported browser */

/** #/demo Settings stage with its back bar ("Back to the book" from the editor, "Library" from the library). State: session (back, books, path). */
export function DemoSettings({ initialSection }: { initialSection?: SettingsSection } = {}) {
  const { set, useDemo } = useSession()
  const d = useDemo()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 bg-chrome px-3"><Button variant="ghost" size="sm" className="h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4" onPress={() => set({ stage: d.back })} data-testid="demo-settings-back"><ChevronLeft />{d.back === "editor" ? "Back to the book" : "Library"}</Button><span className="text-sm font-medium">Settings</span></div>
      <div className="min-h-0 flex-1"><SettingsScreen bookCount={d.books.length} libraryPath={d.path || undefined} initialSection={initialSection} /></div>
    </div>
  )
}
