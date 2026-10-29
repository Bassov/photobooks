/* Shared product screens for feature pages: Home (the one library + its books), library-folder change, fake folder picker, relink dialog. */
import * as React from "react"
import {
  Folder, ChevronRight, } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AppModal, Kbd } from "@/components/app/ui"

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
export { Kbd }
