import { cn } from "@/lib/utils"
import { ImagePlus, AlertTriangle } from "lucide-react"
import { P, T, SPREAD_MM, type Box } from "./data"

export type FrameState = "normal" | "selected" | "drop" | "droppable" | "missing" | "snap"
export const mm = (b: Box) => ({ x: Math.round(b.x * SPREAD_MM.w / 100), y: Math.round(b.y * SPREAD_MM.h / 100), w: Math.round(b.w * SPREAD_MM.w / 100), h: Math.round(b.h * SPREAD_MM.h / 100) })

export function FrameView({ box, photo, state = "normal", showHint = false, mini = false }: {
  box: Box; photo: string | null; state?: FrameState; showHint?: boolean; mini?: boolean
}) {
  const ph = photo ? P(photo) : null
  const m = mm(box)
  return (
    <div className={cn("absolute", (state === "selected" || state === "drop" || state === "snap") && "z-10")}
      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}>
      {ph && state !== "missing" ? (
        <img src={ph.src} className="size-full object-cover" draggable={false} />
      ) : state === "missing" ? (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 hatch-missing text-xs text-ink-warning">
          <AlertTriangle className="size-5" />
          {!mini && <span className="font-medium">IMG_4262.jpg not found</span>}
        </div>
      ) : (
        <div className={cn("flex size-full flex-col items-center justify-center gap-1.5 border border-dashed  bg-placeholder text-placeholder-fg",
          state === "droppable" && " bg-parent-tint")}>
          {!mini && <ImagePlus className="size-5 opacity-70" />}
          {!mini && showHint && <span className="text-xs">Drop photo</span>}
        </div>
      )}
      {state === "drop" && (
        <div className="absolute inset-0 flex items-start justify-center bg-parent/20 pt-3 outline-2 outline-select [outline-style:solid]">
          <span className="rounded-md bg-field px-3 py-1 text-xs font-medium text-foreground shadow">Release to place · fills {m.w} × {m.h} mm</span>
        </div>
      )}
      {(state === "selected" || state === "snap") && <Selection label={`${m.w} × ${m.h} mm`} />}
    </div>
  )
}

function Selection({ label }: { label: string }) {
  const h = "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-2xs bg-white shadow-sm ring-[1.5px] ring-select"
  const pts = [[0, 0], [50, 0], [100, 0], [0, 50], [100, 50], [0, 100], [50, 100], [100, 100]]
  return (
    <div className="pointer-events-none absolute inset-0 shadow-ring-white outline-2 outline-offset-1 outline-select [outline-style:solid]">
      {pts.map(([x, y], i) => <span key={i} className={h} style={{ left: `${x}%`, top: `${y}%` }} />)}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-tag px-1.5 py-0.5 text-2xs font-medium text-white tabular-nums">{label}</span>
    </div>
  )
}

export function SpreadView({ template, photos, width, states = {}, hints = false, mini = false, grid, className }: {
  template: string; photos: (string | null)[]; width: number; states?: Record<number, FrameState>
  hints?: boolean; mini?: boolean; grid?: boolean; className?: string
}) {
  const t = T(template)
  return (
    <div className={cn("relative shrink-0 bg-paper", !mini && "shadow-page", className)} style={{ width, height: width / 2 }}>
      {t.frames.map((b, i) => (
        <FrameView key={i} box={b} photo={photos[i] ?? null} state={states[i]} showHint={hints} mini={mini} />
      ))}
      {grid && <GridOverlay />}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3%] -translate-x-1/2 bg-gradient-to-r from-transparent via-black/[0.07] to-transparent" />
      {mini && <div className="pointer-events-none absolute inset-0 ring-1 ring-black/10 ring-inset" />}
    </div>
  )
}

/* Layout grid per page: 6 × 4, outside margin 15 mm, inside (binding) 20 mm, top/bottom 16 mm, gutter 4 mm */
export const GRID = { outside: 15, inside: 20, top: 16, bottom: 16, cols: 6, rows: 4, gutter: 4 }
function GridOverlay() {
  const px = (v: number) => (v / SPREAD_MM.w) * 100, py = (v: number) => (v / SPREAD_MM.h) * 100
  const page = (side: "l" | "r") => {
    const left = side === "l" ? px(GRID.outside) : 50 + px(GRID.inside)
    const right = side === "l" ? 50 - px(GRID.inside) : 100 - px(GRID.outside)
    const top = py(GRID.top), bottom = py(GRID.bottom), gx = px(GRID.gutter), gy = py(GRID.gutter)
    const w = (right - left - gx * (GRID.cols - 1)) / GRID.cols
    const h = (100 - top - bottom - gy * (GRID.rows - 1)) / GRID.rows
    const cells = []
    for (let c = 0; c < GRID.cols; c++) for (let r = 0; r < GRID.rows; r++)
      cells.push(<div key={`${c}-${r}`} data-allow-border="grid" className="absolute border border-(--grid-line)/60 bg-grid" style={{ left: `${left + c * (w + gx)}%`, top: `${top + r * (h + gy)}%`, width: `${w}%`, height: `${h}%` }} />)
    return (
      <>
        {cells}
        <div data-allow-border="grid" className="absolute border-[1.5px] border-dashed border-(--grid-line)" style={{ left: `${left}%`, top: `${top}%`, width: `${right - left}%`, height: `${100 - top - bottom}%` }} />
      </>
    )
  }
  const tag = "absolute whitespace-nowrap rounded-xs px-1.5 py-px text-2xs font-semibold"
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {page("l")}{page("r")}
      {/* margin dimension markers on the right page */}
      <div className="absolute h-px bg-(--grid-line)" style={{ left: "50%", width: `${px(GRID.inside)}%`, top: "96%" }} />
      <span className={cn(tag, "bg-white/90 text-guide-solid")} style={{ left: "50.3%", top: "92.2%" }}>inside 20</span>
      <div className="absolute h-px bg-(--grid-line)" style={{ left: `${100 - px(GRID.outside)}%`, width: `${px(GRID.outside)}%`, top: "96%" }} />
      <span className={cn(tag, "bg-white/90 text-guide-solid")} style={{ right: "0.3%", top: "92.2%" }}>outside 15</span>
      {/* user guides */}
      <div className="absolute inset-y-0 w-px bg-guide" style={{ left: "20.25%" }} />
      <span className={cn(tag, "bg-guide-solid text-white")} style={{ left: "20.6%", top: "1.5%" }}>guide 81 mm</span>
      {/* snap line along the selected frame's left edge */}
      <div className="absolute inset-y-0 w-[1.5px] bg-bleed" style={{ left: "55%" }} />
      <span className={cn(tag, "bg-bleed text-white")} style={{ left: "55.4%", top: "1.5%" }}>snap · column 1</span>
    </div>
  )
}

export function TemplateThumb({ id, width, className }: { id: string; width: number; className?: string }) {
  const t = T(id)
  return (
    <div className={cn("relative bg-paper ring-1 ring-black/10", className)} style={{ width, height: width / 2 }}>
      {t.frames.map((b, i) => (
        <div key={i} className="absolute bg-placeholder-block" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }} />
      ))}
      <div className="absolute inset-y-0 left-1/2 w-px bg-black/10" />
    </div>
  )
}
