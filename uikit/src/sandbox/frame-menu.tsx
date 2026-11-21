/* Designer frame-context-menu FM1 (M1–M8): the canvas right-click menu on a frame, a multi-selection, an override copy, or
   the paper (page menu: Paste / Paste in place). One fixed order in groups photo · edit · order · lock + delete; a row
   that does not apply now is disabled (arrows skip it), a group that never applies to that kind is hidden. Each row runs
   the command of its key or inspector button with the same undo step. Pick mode (Replace / Place photo…) is photo-pick-kit. */
import * as React from "react"
import { createPortal } from "react-dom"
import {
  Replace, ImagePlus, ImageOff, Shrink, Expand, Crop, Scissors, Copy, ClipboardPaste, CopyPlus,
  BringToFront, ArrowUp, ArrowDown, SendToBack, Lock, LockOpen, Trash2, RotateCcw, EyeOff,
} from "lucide-react"
import { Menu, MenuItem, MenuKeyboard, MenuPopover, MenuSeparator } from "@/components/ui/menu"
import { P } from "@/data"
import { SW, type Frame } from "./model"
import { parentFramesOf, frameContains, resetParentItem } from "./parent-overrides"
import {
  useStudio, mapSpread, mapFrames, removeFrames, deleteLabel, zMove, zMovesFor, startPick, Z_LABEL, type Studio, type ZKind,
} from "./store"
import {
  FRAMES_TYPE, COPIED_MS, countLabel, clipboardMirror, setClipboardMirror, duplicateFrames, framesPayload, pasteFrames, pastedRects,
} from "./clipboard"

/** M7: today's key strings; macOS shows glyphs (Ctrl→⌘, Shift→⇧ before ⌘, Del→⌫) with no "+". */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
const GLYPH: Record<string, string> = { Ctrl: "⌘", Shift: "⇧", Del: "⌫" }
const MOD_ORDER = ["⇧", "⌘"]
export function menuKeys(keys: string, mac = IS_MAC) {
  if (!mac) return keys
  const parts = keys.split("+").map((k) => GLYPH[k] ?? k)
  const mods = MOD_ORDER.filter((m) => parts.includes(m))
  return [...mods, ...parts.filter((p) => !MOD_ORDER.includes(p))].join("")
}

const Z_ROWS: { k: ZKind; id: string; keys: string; Icon: typeof ArrowUp }[] = [
  { k: "front", id: "front", keys: "Shift+Ctrl+]", Icon: BringToFront },
  { k: "fwd", id: "forward", keys: "Ctrl+]", Icon: ArrowUp },
  { k: "bwd", id: "backward", keys: "Ctrl+[", Icon: ArrowDown },
  { k: "back", id: "back", keys: "Shift+Ctrl+[", Icon: SendToBack },
]

type Row = { id: string; label: string; Icon: typeof ArrowUp; keys?: string; enabled?: boolean; destructive?: boolean }
type Group = Row[]
/** Frame menu: `frames` on spread `si` (one frame, or the multi-selection the right-click landed in). */
type At = { kind: "frame"; si: number; ids: string[]; x: number; y: number; keyboard: boolean } | { kind: "page"; si: number; x: number; y: number; keyboard: boolean }

/** Frame copy / paste: the menu acts on spread `si` only on the Pages canvas (D10); Masters / parent editing has no edit group. */
const editScope = (st: Studio) => !!st.features.handles && st.mode === "pages" && !st.features.parentEdit && (!st.node || st.node.k === "book" || st.node.k === "none")

function frameGroups(st: Studio, si: number, frames: Frame[]): Group[] {
  const s = st.doc.spreads[si]
  const f = frames[0], one = frames.length === 1, copy = one && !!f.overrides
  const scope = editScope(st)
  const groups: Group[] = []
  if (copy) groups.push([
    { id: "reset-parent", label: "Reset to parent", Icon: RotateCcw },
    { id: "hide-parent", label: "Hide on this spread", Icon: EyeOff },
  ])
  if (one && f.kind === "image" && scope) {
    // M2: a pick needs an unlocked frame (drops are refused) and ≥ 1 photo in the filmstrip
    const pickable = !f.locked && st.doc.gallery.length > 0
    groups.push(f.photo ? [
      { id: "replace", label: "Replace photo…", Icon: Replace, enabled: pickable },
      { id: "remove", label: "Remove photo", Icon: ImageOff },
      (f.fit ?? "fill") === "fill" ? { id: "fit", label: "Fit photo to frame", Icon: Shrink } : { id: "fit", label: "Fill frame", Icon: Expand },
      { id: "crop", label: "Crop", Icon: Crop },
    ] : [{ id: "place", label: "Place photo…", Icon: ImagePlus, enabled: pickable }])
  }
  if (scope) groups.push([
    { id: "cut", label: "Cut", Icon: Scissors, keys: "Ctrl+X", enabled: frames.some((x) => !x.locked) },
    { id: "copy", label: "Copy", Icon: Copy, keys: "Ctrl+C" },
    { id: "paste", label: "Paste", Icon: ClipboardPaste, keys: "Ctrl+V", enabled: !!clipboardMirror() },
    { id: "duplicate", label: "Duplicate", Icon: CopyPlus, keys: "Ctrl+D" },
  ])
  const lock = frames.every((x) => x.locked)
  // PO3: a copy keeps its parent slot (no order rows); "Hide on this spread" is its delete
  if (!copy) {
    const moves = zMovesFor(s, frames.map((x) => x.id))
    groups.push(Z_ROWS.map((z) => ({ id: z.id, label: Z_LABEL[z.k], Icon: z.Icon, keys: z.keys, enabled: moves.includes(z.k) })))
  }
  groups.push([
    { id: "lock", label: lock ? "Unlock" : "Lock", Icon: lock ? LockOpen : Lock, keys: "Ctrl+Shift+L" },
    ...(copy ? [] : [{ id: "delete", label: deleteLabel(frames), Icon: Trash2, keys: "Del", destructive: true }]),
  ])
  return groups
}

const pageGroups = (): Group[] => [[
  { id: "page-menu-paste", label: "Paste", Icon: ClipboardPaste, keys: "Ctrl+V" },
  { id: "page-menu-paste-in-place", label: "Paste in place", Icon: ClipboardPaste, keys: "Shift+Ctrl+V" },
]]

/** The frame copy also goes to the system clipboard (a one-shot copy event ahead of the editor's own listener), so Ctrl+V pastes it. */
function writeClipboard(json: string) {
  const on = (e: ClipboardEvent) => { e.stopImmediatePropagation(); e.preventDefault(); e.clipboardData?.setData(FRAMES_TYPE, json) }
  document.addEventListener("copy", on, { capture: true })
  try { document.execCommand("copy") } catch { /* no clipboard: the mirror still pastes from the menu */ }
  document.removeEventListener("copy", on, { capture: true })
}

function run(st: Studio, at: At, key: string) {
  const si = at.si
  const flash = (text: string) => { st.setStatus(text); setTimeout(() => st.setStatus(""), COPIED_MS) }
  const paste = (inPlace: boolean) => {
    const p = clipboardMirror()
    if (!p) return
    const { doc, ids } = pasteFrames(st.doc, si, p, pastedRects(st.doc, si, p, { inPlace }))
    st.update(() => doc, countLabel("Paste", ids.length), undefined, si)
    st.setCropId(null)
    st.setSel(ids)
  }
  if (at.kind === "page") { paste(key === "page-menu-paste-in-place"); return }
  const frames = st.doc.spreads[si].frames.filter((f) => at.ids.includes(f.id))
  if (!frames.length) return
  const ids = frames.map((f) => f.id), f = frames[0]
  const set = (patch: Partial<Frame>, label: string) => st.update((d) => mapFrames(d, si, ids, (x) => ({ ...x, ...patch })), label)
  const copyOut = (cutIds: string[]) => {
    const p = framesPayload(st.doc, si, cutIds)
    setClipboardMirror(p)
    writeClipboard(JSON.stringify(p))
  }
  switch (key) {
    case "reset-parent": st.update((d) => mapSpread(d, si, (s) => resetParentItem(s, f.overrides!)), "Reset to parent"); st.setSel([]); return
    case "hide-parent": case "delete": st.update((d) => removeFrames(d, si, ids), deleteLabel(frames)); st.setCropId(null); st.setSel([]); return
    case "replace": case "place": startPick(st, si, f.id, key); return
    case "remove": { const name = f.photo ? P(f.photo).name : ""; set({ photo: null }, "Remove photo"); st.setStatus(`${name} is back in the gallery`); return }
    case "fit": { const fit = (f.fit ?? "fill") === "fill" ? "fit" : "fill"; set({ fit, zoom: 1, ox: 0, oy: 0 }, fit === "fit" ? "Fit photo" : "Fill frame"); return }
    case "crop": st.setCropId(f.id); st.setStatus("Crop: drag to move the photo, corners or wheel to zoom, Tab + arrows to nudge, Esc to finish"); return
    case "copy": copyOut(ids); flash(ids.length > 1 ? `Copied ${ids.length} frames` : "Copied frame"); return
    case "cut": {
      const free = frames.filter((x) => !x.locked).map((x) => x.id)
      copyOut(free)
      st.update((d) => removeFrames(d, si, free), countLabel("Cut", free.length))
      st.setCropId(null)
      st.setSel(st.sel.filter((id) => !free.includes(id)))
      return
    }
    case "paste": paste(false); return
    case "duplicate": {
      const { doc, ids: made } = duplicateFrames(st.doc, si, ids)
      st.update(() => doc, countLabel("Duplicate", made.length))
      st.setCropId(null)
      st.setSel(made)
      return
    }
    case "lock": { const lk = !frames.every((x) => x.locked); set({ locked: lk }, lk ? "Lock" : "Unlock"); return }
  }
  const z = Z_ROWS.find((r) => r.id === key)
  if (z) st.update((d) => zMove(d, si, ids, z.k), Z_LABEL[z.k])
}

/** The spread a canvas element belongs to, and its index. */
const spreadOf = (el: Element) => el.closest<HTMLElement>('[data-testid="spread"][data-spread]')
/** A pointer on the spread paper in spread mm (the paper is SW mm wide on screen). */
function mmAt(paper: HTMLElement, e: { clientX: number; clientY: number }) {
  const b = paper.getBoundingClientRect(), k = b.width / SW
  return { x: (e.clientX - b.left) / k, y: (e.clientY - b.top) / k }
}

/**
 * Mounted once per Viewport: a document `contextmenu` on this viewport's own frame (or, by the keyboard path, on the selection)
 * selects it and opens the frame menu; on the paper with no frame and no parent frame under the pointer, the page menu, when
 * frames have been copied. Otherwise the browser menu stays.
 */
export function FrameMenu() {
  const st = useStudio()
  const live = React.useRef(st)
  live.current = st
  const marker = React.useRef<HTMLSpanElement>(null)
  const anchor = React.useRef<HTMLDivElement>(null)
  const [at, setAt] = React.useState<At | null>(null)
  React.useEffect(() => {
    let menuKey = false
    const onKey = (e: KeyboardEvent) => { menuKey = e.key === "ContextMenu" || (e.shiftKey && e.key === "F10") }
    const onContextMenu = (e: MouseEvent) => {
      const s = live.current, root = marker.current?.parentElement
      if (!root || !s.features.handles) return
      const keyboard = menuKey || (e.clientX === 0 && e.clientY === 0)
      menuKey = false
      const t = e.target instanceof Element ? e.target : null
      const frameEl = (si: number, id: string) => root.querySelector<HTMLElement>(`[data-testid="spread"][data-spread="${si}"] [data-testid="frame"][data-frame="${CSS.escape(id)}"]`)
      const open = (si: number, id: string) => {
        e.preventDefault()
        // a right-click inside a multi-selection keeps it: the menu acts on the set
        const inSet = si === s.cur && s.sel.length > 1 && s.sel.includes(id)
        const ids = inSet ? s.sel : [id]
        if (!inSet) { s.setCur(si); s.setSel([id]) }
        if (s.cropId && s.cropId !== id) s.setCropId(null)
        // the keyboard path opens at the frame's bottom-left corner
        const r = frameEl(si, id)?.getBoundingClientRect()
        setAt({ kind: "frame", si, ids, keyboard, ...(keyboard && r ? { x: r.left, y: r.bottom } : { x: e.clientX, y: e.clientY }) })
      }
      const cur = s.doc.spreads[s.cur]
      const sel = cur?.frames.filter((f) => s.sel.includes(f.id)) ?? []
      // the keyboard path off a frame: the selection on the current spread
      if (keyboard && sel.length && !t?.closest('[data-testid="frame"]')) { open(s.cur, sel[0].id); return }
      if (!t || !root.contains(t)) return
      // a selected frame under the pointer comes first (its crop / handle chrome sits on top; an override copy paints
      // under own frames), as prod handleOwner; else the own frame hit
      const paperCur = root.querySelector<HTMLElement>(`[data-testid="spread"][data-spread="${s.cur}"]`)
      const hitSel = paperCur && sel.filter((f) => frameContains(f, mmAt(paperCur, e))).at(-1)
      if (hitSel) { open(s.cur, hitSel.id); return }
      const fEl = t.closest<HTMLElement>('[data-testid="frame"][data-frame]'), fSpread = fEl && spreadOf(fEl)
      if (fEl && fSpread) {
        const si = Number(fSpread.dataset.spread), id = fEl.dataset.frame!
        if (s.doc.spreads[si]?.frames.some((f) => f.id === id)) open(si, id)
        return
      }
      // M6 page menu: book spread paper on the Pages canvas, nothing copied → the browser menu stays
      const paper = spreadOf(t)
      if (!paper || !clipboardMirror() || !editScope(s)) return
      const si = Number(paper.dataset.spread), sp = s.doc.spreads[si]
      if (!sp) return
      const p = mmAt(paper, e)
      if (parentFramesOf(s.doc, sp).some((f) => frameContains(f, p))) return
      e.preventDefault()
      s.setCur(si)
      s.setSel([])
      setAt({ kind: "page", si, keyboard, x: e.clientX, y: e.clientY })
    }
    window.addEventListener("keydown", onKey, true)
    document.addEventListener("contextmenu", onContextMenu)
    return () => { window.removeEventListener("keydown", onKey, true); document.removeEventListener("contextmenu", onContextMenu) }
  }, [])
  // the menu closes when its frames go away (undo, another view)
  const gone = at?.kind === "frame" && !st.doc.spreads[at.si]?.frames.some((f) => at.ids.includes(f.id))
  React.useEffect(() => { if (gone) setAt(null) }, [gone])
  const close = React.useCallback(() => setAt(null), [])
  const groups = !at || gone ? [] : at.kind === "page" ? pageGroups() : frameGroups(st, at.si, st.doc.spreads[at.si].frames.filter((f) => at.ids.includes(f.id)))
  const rows = groups.flat()
  return (
    <>
      <span ref={marker} hidden />
      {createPortal(<div ref={anchor} aria-hidden data-testid="frame-menu-anchor" className="pointer-events-none fixed size-0" style={{ left: at?.x ?? 0, top: at?.y ?? 0 }} />, document.body)}
      {at && rows.length > 0 && (
        <MenuPopover triggerRef={anchor} isOpen onOpenChange={(o) => { if (!o) close() }} placement="bottom start"
          // M6 / PO4: the page menu's press hint stays on one line; frame and set menus keep the kit's 224 px
          className={at.kind === "page" ? "w-max min-w-56" : "w-56"}>
          <Menu aria-label={at.kind === "page" ? "Page" : at.ids.length > 1 ? "Frames" : "Frame"} data-testid={at.kind === "page" ? "page-menu" : "frame-menu"}
            // M5: a pointer open focuses the menu (no row highlighted); the keyboard path focuses the first enabled row
            autoFocus={at.keyboard ? "first" : true}
            disabledKeys={rows.filter((r) => r.enabled === false).map((r) => r.id)}
            className="[&_svg]:size-4 [&_svg]:text-muted-foreground"
            onAction={(key) => { const a = at; close(); run(live.current, a, String(key)) }}>
            {groups.map((g, gi) => (
              <React.Fragment key={g[0].id}>
                {gi > 0 && <MenuSeparator />}
                {g.map(({ id, label, Icon, keys, destructive }) => (
                  <MenuItem key={id} id={id} textValue={label} variant={destructive ? "destructive" : undefined} data-testid={at.kind === "page" ? id : `frame-menu-${id}`}>
                    <Icon />
                    {label}
                    {/* prod .pb-menu-keyboard: the row font (kit <kbd> is mono, which makes rows taller) */}
                    {keys && <MenuKeyboard className="[font-family:inherit]">{menuKeys(keys)}</MenuKeyboard>}
                  </MenuItem>
                ))}
              </React.Fragment>
            ))}
          </Menu>
        </MenuPopover>
      )}
    </>
  )
}
