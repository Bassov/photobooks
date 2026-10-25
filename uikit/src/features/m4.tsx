import { ContextInspector } from "@/sandbox/context-inspector"
/* M4 Free layout: grids, guides, frames */
import { TopBar } from "@/sandbox/chrome"
import { InspectorPanel, PhotoSection, GeometrySection, CropSection, PhotoRotateSection, ArrangeSection, AlignSection, DeleteFrameButton, EmptyInspector, useSelected } from "@/sandbox/inspector"
import { GridSection, GuidesSection, SpreadBgSection } from "@/sandbox/sections"
import { makeDoc, spread, frame, uid, type Doc } from "@/sandbox/model"
import { Std } from "./parts"
import type { FeatureDef } from "./types"

const withGuides = (): Doc => {
  const d = makeDoc()
  d.spreads[2] = { ...d.spreads[2], guides: [{ id: uid("g"), axis: "v", pos: 100, scope: "spread" }, { id: uid("g"), axis: "h", pos: 60, scope: "spread" }] }
  return d
}
const overlapDoc = (): Doc => {
  const d = makeDoc()
  d.spreads[2] = spread(null, [], {
    frames: [frame({ x: 18, y: 18, w: 210, h: 150, photo: "p16" }), frame({ x: 150, y: 60, w: 150, h: 110, photo: "p07", rot: -4 }), frame({ x: 260, y: 26, w: 110, h: 80, photo: "p11", locked: true }), frame({ x: 236, y: 120, w: 130, h: 64, photo: "p03" })],
  })
  return d
}
const freeDoc = (): Doc => {
  const d = makeDoc()
  d.spreads[2] = spread(null, [], { frames: [frame({ x: 20, y: 20, w: 160, h: 160, photo: "p16" }), frame({ x: 224, y: 40, w: 120, h: 90, photo: "p07" })] })
  return d
}

function FrameTab({ rotate = false, crop = false, arrange = false, align = false, del = false, rotation = true }: { rotate?: boolean; crop?: boolean; arrange?: boolean; align?: boolean; del?: boolean; rotation?: boolean }) {
  const { f } = useSelected()
  if (!f) return <EmptyInspector />
  return <>{align && <AlignSection />}<PhotoSection />{rotate && <PhotoRotateSection />}<GeometrySection rotation={rotation} />{crop && <CropSection />}{arrange && <ArrangeSection />}{del && <DeleteFrameButton />}</>
}

const H = (k: [string, string][]) => k
export const M4: Record<string, FeatureDef> = {
  rulers: {
    Demo: () => <Std view={{ rulers: true }} features={{ drop: true, handles: true }} top={<TopBar views={["rulers", "snap", "guides"]} />} />,
    notes: { what: "Top and left rulers in millimetres that follow the camera (zoom / pan); ticks count from the trim of each page.", where: "Canvas edges; a toggle in the top bar.", why: "Judge print sizes and spacing precisely.", keys: H([["Shift+R", "show / hide rulers"], ["Ctrl+wheel", "zoom — tick spacing adapts"]]), edge: ["At low zoom ticks thin out (10 → 50 mm)", "The cursor position is highlighted on the rulers"] },
  },
  guides: {
    Demo: () => <Std init={withGuides} view={{ rulers: true, guides: true }} features={{ drop: true, handles: true }} top={<TopBar views={["rulers", "guides", "snap"]} />} right={<InspectorPanel frame={<FrameTab rotation={false} />} spread={<GuidesSection bookScope={false} precise={false} />} defaultTab="spread" />} />,
    notes: { what: "An editor layer above the spread (never in output): drag from a ruler to create a guide; drag it around; drag it back onto the ruler to delete.", where: "Rulers → canvas; the list in the Spread tab.", why: "Align several frames on one line without a grid.", keys: H([["Ctrl+;", "show / hide guides"], ["Shift+S", "snapping on / off"]]), edge: ["Guides are editor-only — not in PDF and not on the site", "Frames snap to guides", "Hidden guides do not snap"] },
  },
  "guides-precise": {
    Demo: () => <Std init={withGuides} view={{ rulers: true, guides: true }} features={{ drop: true, handles: true }} top={<TopBar views={["rulers", "guides", "snap"]} />} right={<InspectorPanel frame={<FrameTab rotation={false} />} spread={<GuidesSection />} defaultTab="spread" />} />,
    notes: { what: "Numeric position, locking, and scope: this spread or the whole book.", where: "Spread tab → Guides.", why: "Repeatable layout: the same line on every spread.", edge: ["A book guide appears on every spread; editing it changes it everywhere", "A locked guide cannot be moved or deleted", "The position is clamped to the spread size"] },
  },
  "frame-selection-handles": {
    Demo: () => <Std features={{ drop: true, handles: true, rotateHandle: true }} pick={1} right={<InspectorPanel frame={<FrameTab />} />} />,
    notes: { what: "Click selects a frame; 8 handles resize, the round one above rotates; dragging the body moves; all with live snapping.", where: "Canvas.", why: "The familiar Figma / InDesign model.", keys: H([["Shift", "keep proportions / 15° rotation steps"], ["Alt", "from centre / no snapping"], ["arrows", "nudge 1 mm (Shift 10)"], ["Esc", "deselect"]]), edge: ["Minimum size 5 mm", "A locked frame shows no handles", "One gesture = one history step"] },
  },
  "layout-grids-settings": {
    Demo: () => <Std view={{ grid: true }} features={{ drop: true, handles: true }} top={<TopBar views={["grid", "snap"]} />} right={<InspectorPanel frame={<FrameTab rotation={false} />} spread={<GridSection scope="spread" />} book={<GridSection scope="book" title="Book grid" />} defaultTab="book" />} />,
    notes: { what: "Grid section: margins (top / bottom / inside / outside), columns, rows, gutters for the book; a spread can override single fields and “Reset to book grid”.", where: "Inspector → Book / Spread.", why: "The rhythm of the whole book is set in one place.", edge: ["BOOK / SPREAD source labels next to each field", "Columns 1–12", "Templates read margins from the effective grid"] },
  },
  "layout-grids-render-snap": {
    Demo: () => <Std init={freeDoc} view={{ grid: true }} features={{ drop: true, handles: true }} sel={[]} top={<TopBar views={["grid", "snap"]} />} />,
    notes: { what: "The grid is drawn on the editor layer (margins, columns, rows on each page); moving and resizing frames snaps to it with a “column 3” label.", where: "Canvas; Ctrl+' shows / hides it.", why: "Cleanly aligned spreads without arithmetic.", keys: H([["Ctrl+'", "grid"], ["Alt+drag", "temporarily no snapping"]]), edge: ["A hidden grid does not snap", "The grid never appears in Preview, PDF or on the site"] },
  },
  "free-frames": {
    Demo: () => <Std init={freeDoc} pick={1} features={{ drop: true, handles: true, rotateHandle: true, swap: true }} right={<ContextInspector />} top={<TopBar tools={["select", "frame", "hand"]} views={["snap", "grid", "guides"]} />} />,
    notes: { what: "Frame tool (F): draw a frame on the spread; Delete removes it; live snap lines to guides, other frames and equal gaps.", where: "Tool bar; canvas.", why: "Not limited to templates.", keys: H([["F", "Frame tool"], ["V", "select"], ["Delete", "delete frame"]]), edge: ["A spread with edited frames is no longer “templated”", "Empty frames accept photos from the filmstrip", "Frames smaller than 5 mm are not created"] },
  },
  "photo-rotate": {
    Demo: () => <Std features={{ drop: true, crop: true }} pick={0} right={<InspectorPanel frame={<FrameTab rotate crop rotation={false} />} />} />,
    notes: { what: "Rotate 90° left / right and straighten the horizon (±45°) inside the frame; cover fit is recomputed so there are no empty corners.", where: "Inspector → Rotate photo.", why: "Fix a tilted horizon or a camera held sideways.", edge: ["Strong straightening scales the photo up — DPI drops (the DPI badge warns)", "A quarter turn resets the crop"] },
  },
  inspector: {
    Demo: () => <Std features={{ drop: true, handles: true, rotateHandle: true, crop: true }} pick={1} right={<InspectorPanel frame={<FrameTab crop />} spread={<><SpreadBgSection /><GridSection scope="spread" /></>} book={<GridSection scope="book" title="Book grid" />} />} />,
    notes: { what: "Right panel: position, size, rotation and crop of the selected frame; Frame / Spread / Book tabs.", where: "Right side; collapsible.", why: "Exact numbers where the mouse is imprecise.", keys: H([["↑ ↓ in a field", "±1 (Shift ±10)"], ["Enter", "apply"], ["Tab", "next field"]]), edge: ["Typing in one field = one history step (coalesced)", "Empty state when nothing is selected", "Several frames — “editing the first of N”"] },
  },
  "arrange-lock": {
    Demo: () => <Std init={overlapDoc} features={{ drop: true, handles: true }} pick={1} right={<InspectorPanel frame={<FrameTab arrange />} />} />,
    notes: { what: "Z-order: bring to front / send to back / one step; lock from the inspector and with a shortcut.", where: "Inspector → Arrange; the lock in Position & size.", why: "Overlapping collages.", keys: H([["Ctrl+] / [", "one step forward / back"], ["Ctrl+Shift+] / [", "to front / to back"], ["Ctrl+Shift+L", "lock"]]), edge: ["A locked frame cannot be moved but can be selected and unlocked", "A lock icon on the canvas"] },
  },
  "multi-select": {
    Demo: () => <Std init={overlapDoc} features={{ drop: true, handles: true, multi: true, marquee: true }} pick={[0, 1, 3]} right={<ContextInspector />} />,
    notes: { what: "Shift+click or a marquee; group move; align and distribute.", where: "Canvas; inspector → Align & distribute.", why: "Align 4 photos in one click.", keys: H([["Shift+click", "add to / remove from selection"], ["drag on empty space", "marquee"], ["Ctrl+A", "select all"]]), edge: ["Distribute needs 3+ frames", "Locked frames are skipped when aligning", "The common bounding box is dashed"] },
  },
}
