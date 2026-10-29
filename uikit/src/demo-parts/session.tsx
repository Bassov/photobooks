/* Stage 2: the #/demo session store, made instantiable. #/demo uses the module-level DEMO_SESSION (context default,
   so no provider is mounted and the render tree is unchanged); a feature page can mount <DemoSessionProvider initial={…}>. */
import * as React from "react"
import type { Book } from "@/sandbox/store"
import { makeDoc, SAMPLE_BOOK, type Doc } from "@/sandbox/model"
import { getEditorExtras, defaultMasters, type CoverText } from "@/sandbox/v7"
import type { LibBook } from "@/features/library"

export type Extras = ReturnType<typeof getEditorExtras>
export type Stage = "welcome" | "library" | "editor" | "settings" | "site"
export type DBook = { id: string; title: string; book: Book; doc?: Doc; cover?: string; published?: boolean; extras?: Extras }
export type SessionState = { stage: Stage; path: string; books: DBook[]; open: string | null; back: Stage; nonce: number; siteEntry: "catalog" | "book" }
export type Session = { S: SessionState; set: (p: Partial<SessionState>) => void; useDemo: () => SessionState }

export const INITIAL_SESSION: SessionState = { stage: "welcome", path: "", books: [], open: null, back: "library", nonce: 0, siteEntry: "catalog" }
export function createSession(initial: Partial<SessionState> = {}): Session {
  const S: SessionState = { ...INITIAL_SESSION, ...initial }
  const subs = new Set<() => void>()
  let snap = { ...S }
  const set = (p: Partial<SessionState>) => { Object.assign(S, p); snap = { ...S }; subs.forEach((f) => f()) }
  const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
  const useDemo = () => React.useSyncExternalStore(subscribe, () => snap)
  return { S, set, useDemo }
}
/* in-memory session store of #/demo (survives leaving and re-entering #/demo until reload) */
export const DEMO_SESSION = createSession()
const SessionCtx = React.createContext<Session>(DEMO_SESSION)
export const useSession = () => React.useContext(SessionCtx)
/** Standalone mount: an isolated session with the given initial state. */
export function DemoSessionProvider({ initial, children }: { initial?: Partial<SessionState>; children: React.ReactNode }) {
  const [s] = React.useState(() => createSession(initial))
  return <SessionCtx.Provider value={s}>{children}</SessionCtx.Provider>
}

export const firstPhoto = (d: Doc) => { for (const s of d.spreads) for (const f of s.frames) if (f.photo) return f.photo; return undefined }
/* v0.8.1 (P2-7): a new book is blank — empty frames, no photos, no sample cover text (the cover takes the book's own title) */
export const blankDoc = () => makeDoc(SAMPLE_BOOK.map(([t, p]) => [t, p.map(() => null)] as [string | null, (string | null)[]]), { gallery: [] })
export const blankExtras = (title: string): Extras => ({ cover: "", coverText: { front: title, spine: title, back: title } as CoverText, masters: defaultMasters() })
export const coverOf = (b: DBook) => b.extras?.cover || (b.doc ? firstPhoto(b.doc) : undefined) || undefined
export const fmtOf = (b: Book): LibBook["fmt"] => (b.w === b.h ? "square" : b.w > b.h ? "landscape" : "portrait")
export const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book"
/** Progress 0…100 over `ms` while `on` (rAF + performance.now). */
export function useRun(on: boolean, ms: number, done: () => void) {
  const [v, setV] = React.useState(0)
  React.useEffect(() => {
    if (!on) return; setV(0)
    const t0 = performance.now(); let raf = 0
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / ms); setV(Math.round(k * 100)); if (k < 1) raf = requestAnimationFrame(tick); else done() }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [on]) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}
