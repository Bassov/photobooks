import * as React from "react"
import { FolderOpen, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react"
import { MenuTrigger, MenuPopover, Menu, MenuItem, MenuSeparator } from "@/components/ui/menu"
import { Button } from "@/components/ui/button"
import { TextField, Input } from "@/components/ui/textfield"
import { AlertDialog, IconButton } from "@/components/app/ui"
import { P } from "@/data"
import { LibraryBar, LibraryEmpty, BookTile, LibStyle, LibSearch, LibSort, type SortKey } from "@/features/library"
import { CreateBookDialog } from "@/features/create-book"
import { FolderPicker } from "@/features/screens"
import { useSession, coverOf, fmtOf, type DBook } from "./session"

/** #/demo library home (books grid, search, sort, rename / duplicate / remove, change folder, create book). State: the session (books, path). */
/** Optional initial UI state for standalone mounts (feature pages). #/demo passes none, so every default is the #/demo start state. */
export type LibraryInit = { creating?: boolean; picking?: boolean; confirmChange?: boolean; renaming?: string; removing?: string; query?: string }
export function DemoLibrary({ init = {} }: { init?: LibraryInit } = {}) {
  const { S, set, useDemo } = useSession()
  const d = useDemo()
  const [creating, setCreating] = React.useState(init.creating ?? false)
  const [picking, setPicking] = React.useState(init.picking ?? false)
  const [confirmChange, setConfirmChange] = React.useState(init.confirmChange ?? false)
  const [renaming, setRenaming] = React.useState<string | null>(init.renaming ?? null)
  const [removing, setRemoving] = React.useState<DBook | null>(() => S.books.find((x) => x.id === init.removing) ?? null)
  const [query, setQuery] = React.useState(init.query ?? "")
  const [sort, setSort] = React.useState<SortKey>("edited")
  const shown = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const list = d.books.filter((b) => !q || b.title.toLocaleLowerCase().includes(q))
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === "created") return [...list].reverse()
    return list
  }, [d.books, query, sort])
  const rename = (id: string, v: string) => { set({ books: S.books.map((x) => (x.id === id ? { ...x, title: v.trim() || x.title } : x)) }); setRenaming(null) }
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-app" data-testid="home">
      <LibStyle />
      <LibraryBar path={d.path} onChange={() => setConfirmChange(true)} onSettings={() => set({ stage: "settings", back: "library" })}
        tools={d.books.length > 0 ? <><LibSearch value={query} onChange={setQuery} /><LibSort value={sort} onChange={setSort} /></> : null} />
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ background: "radial-gradient(1200px 800px at 50% 30%, #D6D6D6, #C8CACB 75%)" }}>
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-12">
          <div className="flex items-end justify-between pb-2 pt-10">
            <div className="flex items-baseline gap-3"><h2 className="text-display leading-none" style={{ fontFamily: "var(--font-heading)" }}>Your books</h2>{d.books.length >= 1 && <span className="text-sm text-muted-foreground" data-testid="book-count">{d.books.length} {d.books.length === 1 ? "book" : "books"}</span>}</div>
            {d.books.length > 0 && <Button className="h-10 rounded-full px-6 text-base shadow-ink-sm" onPress={() => setCreating(true)} data-testid="new-book">Create book</Button>}
          </div>
          {d.books.length === 0 ? <LibraryEmpty onCreate={() => setCreating(true)} /> : shown.length === 0 ? (
            <div className="mt-20 text-center text-sm text-muted-foreground" data-testid="lib-no-results">No books match “{query.trim()}”. <button type="button" className="underline underline-offset-2" onClick={() => setQuery("")}>Clear search</button></div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-10 gap-y-2 pb-12" data-testid="book-grid">
              {shown.map((b) => (
                <BookTile key={b.id} b={{ id: b.id, title: b.title, src: coverOf(b) ? P(coverOf(b)!).src : undefined, fmt: fmtOf(b.book), spreads: b.doc?.spreads.length ?? 10, edited: "just now", status: b.published ? "published" : undefined }}
                  onOpen={() => set({ stage: "editor", open: b.id })}
                  title={renaming === b.id ? (
                    <TextField aria-label="Book title" defaultValue={b.title} autoFocus onKeyDown={(e) => { if (e.key === "Enter") rename(b.id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setRenaming(null) }} onBlur={(e) => rename(b.id, (e.target as HTMLInputElement).value)}>
                      <Input className="h-7 w-full px-2 text-sm" data-testid="rename-input" />
                    </TextField>
                  ) : undefined}
                  menu={
                    <MenuTrigger>
                      <IconButton label="Book actions" size="sm" tooltip={false} className="reveal-on-hover opacity-0 group-hover:opacity-100 data-[focus-visible]:opacity-100 aria-expanded:opacity-100" data-testid="book-menu"><MoreHorizontal /></IconButton>
                      <MenuPopover placement="bottom end" className="w-44">
                        <Menu className="[&_svg]:size-4 [&_svg]:text-muted-foreground" onAction={(k) => {
                          if (k === "open") set({ stage: "editor", open: b.id })
                          if (k === "rename") setRenaming(b.id)
                          if (k === "dup") set({ books: [{ ...b, id: `db${Date.now()}`, title: `${b.title} (copy)`, published: false }, ...S.books] })
                          if (k === "rm") setRemoving(b) }}>
                          <MenuItem id="open"><FolderOpen />Open</MenuItem>
                          <MenuItem id="rename"><Pencil />Rename</MenuItem><MenuItem id="dup"><Copy />Duplicate</MenuItem>
                          <MenuSeparator /><MenuItem id="rm" variant="destructive"><Trash2 />Remove…</MenuItem>
                        </Menu>
                      </MenuPopover>
                    </MenuTrigger>
                  } />
              ))}
            </div>
          )}
        </div>
      </main>
      <AlertDialog isOpen={!!removing} title={<>Remove “{removing?.title}”?</>} confirmLabel="Remove book"
        onCancel={() => setRemoving(null)} onConfirm={() => { set({ books: S.books.filter((y) => y.id !== removing!.id) }); setRemoving(null) }}>
        The book is removed from your library folder. Photos stay on disk, untouched.
      </AlertDialog>
      <AlertDialog isOpen={confirmChange} tone="neutral" icon={<FolderOpen />} title="Change the library folder?" confirmLabel="Choose folder…"
        onCancel={() => setConfirmChange(false)} onConfirm={() => { setConfirmChange(false); setPicking(true) }}>
        Photobooks works with one library at a time. Your books stay in <span className="font-mono text-sm text-foreground/80">{d.path}</span> — nothing is moved or deleted. Pick another folder to use it as the library (an empty folder starts a new one). Change it back to see these books again.
      </AlertDialog>
      <CreateBookDialog isOpen={creating} onCancel={() => setCreating(false)} onCreate={(title, book) => {
        const id = `db${Date.now()}`; setCreating(false); set({ books: [{ id, title, book }, ...S.books], open: id, stage: "editor" })
      }} />
      <FolderPicker isOpen={picking} title="Choose the library folder" onCancel={() => setPicking(false)} onPick={(p) => { setPicking(false); set({ path: p }) }} />
    </div>
  )
}
