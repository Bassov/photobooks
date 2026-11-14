/* Stage 2: the #/demo session store, made instantiable. #/demo uses the module-level DEMO_SESSION (context default,
   so no provider is mounted and the render tree is unchanged); a feature page can mount <DemoSessionProvider initial={…}>. */
import * as React from "react"
import type { Book } from "@/sandbox/store"
import { makeDoc, SAMPLE_BOOK, type Doc } from "@/sandbox/model"
import { getEditorExtras, defaultMasters, type CoverText } from "@/sandbox/v7"
import type { LibBook } from "@/features/library"
import type { UnsupportedVariant } from "@/features/unsupported"
import { GENERIC_ID, SAMPLE_CUSTOMS, type KitProfile } from "./printProfiles"
import { SAMPLE_SITE_TEXTS, type SiteTexts } from "@/features/site/sample"
import type { SettingsSection } from "./settings"

export type Extras = ReturnType<typeof getEditorExtras>
export type Stage = "welcome" | "library" | "editor" | "settings" | "site" | "unsupported"
export type DBook = { id: string; title: string; book: Book; doc?: Doc; cover?: string; published?: boolean; extras?: Extras
  /** ids of photos whose files can't be found (seeded by `__demo.missing()`; resolved through Relink) */ missing?: string[]
  /** printer-presets D6: the book's print profile id; absent = Generic */ printProfile?: string }
/** publish-credentials: what Settings → Hosting keeps after Connect. Never the secret, and the access key's last 4 only. */
export type HostingCode = "InvalidAccessKeyId" | "AccessDenied" | "NoSuchBucket" | "Cors" | "Offline" | "Timeout"
export type HostingRecord = { accountId: string; bucket: string; accessKeyTail: string; publicBaseUrl: string; checkedAtMs: number; ok: boolean; code?: HostingCode
  /** connect-own-hosting: how the record was made (absent = manual), when setup made it, and the setup token it couldn't delete (C10) */
  origin?: "setup" | "manual"; provisionedAtMs?: number; setupTokenLeft?: boolean }
export const todayAt = (h: number, m: number) => new Date().setHours(h, m, 0, 0)
export const SAMPLE_HOSTING: HostingRecord = { accountId: "0f3a9c51e2b74d0a8c66f1e9d3b241c2", bucket: "aleksandr-books", accessKeyTail: "9f2c", publicBaseUrl: "https://books.basov.photo", checkedAtMs: todayAt(22, 40), ok: true }
export type SessionState = { stage: Stage; path: string; books: DBook[]; open: string | null; back: Stage; nonce: number; siteEntry: "catalog" | "book"
  /** the "unsupported" stage: which variant, and the browser named in its copy */ unsupported?: { variant: UnsupportedVariant; browserName?: string }
  /** printer-presets D6: the library's custom print profiles and the default for new books */ printProfiles: KitProfile[]; defaultPrintProfileId: string
  /** publish-credentials: the stored hosting connection; null = not connected */ hosting: HostingRecord | null
  /** personal-site D37: Settings → Site; the site lead reads `intro` */ site: SiteTexts
  /** in-app-publish: the section the settings stage opens on ("Open Settings → Hosting"); absent = Library */ settingsSection?: SettingsSection }
export type Session = { S: SessionState; set: (p: Partial<SessionState>) => void; useDemo: () => SessionState }

export const INITIAL_SESSION: SessionState = { stage: "welcome", path: "", books: [], open: null, back: "library", nonce: 0, siteEntry: "catalog", printProfiles: SAMPLE_CUSTOMS, defaultPrintProfileId: GENERIC_ID, hosting: SAMPLE_HOSTING, site: SAMPLE_SITE_TEXTS }
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
  }, [on])
  return v
}
