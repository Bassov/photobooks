/* Stage 3: seed states for standalone mounts — the books and documents #/demo reaches along its path. */
import { photos } from "@/data"
import { BOOK0, type Book } from "@/sandbox/store"
import { makeDoc, SAMPLE_BOOK, type Doc } from "@/sandbox/model"
import { blankDoc, blankExtras, type DBook, type Extras } from "./session"

/** The size the #/demo path creates (Create book → Custom size 19 × 23 cm). */
export const LAKE_BOOK: Book = { ...BOOK0, preset: "custom", w: 19, h: 23 }
export const LAKE_TITLE = "Lake trip"
/** New book: blank frames, no photos (#/demo step 8). */
export const docBlank = (): Doc => blankDoc()
/** After Add folder…: every kit photo in the filmstrip, nothing placed (#/demo step 11). */
export const docAdded = (): Doc => ({ ...blankDoc(), gallery: photos.map((p) => p.id) })
/** Photos placed in the frames (the sample book). */
export const docFilled = (): Doc => makeDoc(SAMPLE_BOOK)
/** Cover with a photo and the edited title (#/demo step 13). */
export const COVER_DONE: Partial<Extras> = { cover: photos[3].id, coverText: { ...blankExtras(LAKE_TITLE).coverText, front: "Lake trip 2026" } }
/** One session book. */
export function dbook(id: string, title: string, o: Partial<DBook> = {}): DBook {
  return { id, title, book: LAKE_BOOK, doc: docFilled(), extras: blankExtras(title), ...o }
}
/** Library with a few books (titles as the #/demo path makes them, plus two more). */
export const SHELF = (): DBook[] => [
  dbook("lake", "Lake trip ’26", { extras: { ...blankExtras("Lake trip ’26"), ...COVER_DONE }, published: true }),
  dbook("tatra", "Tatra, autumn", { book: { ...BOOK0, preset: "A4", w: 29.7, h: 21 } }),
  dbook("sea", "Black Sea", { book: BOOK0 }),
]
