/* The CSS Book3D: the fallback of the GL book (`book3d.tsx`; Spec site-stand-v2 G: `?gl=0`, no WebGL2, the import fails).
   Book3D v2 (Spec site-stand S1): a hardcover at its true relative size, built like one: two boards (`bt`), the spine with
   the title, a page block recessed by the squares (`sq`), head and fore-edge faces, a floor shadow and a contact shadow,
   lit from the top left. `s` = px per cm. The pose is one set for every demo (`book3d.css`), driven by the nearest host
   (`.sd-host`, a link or a button: hover / focus / active), or `pose` (the hero, which follows the pointer). */
import * as React from "react"
import { CoverFace } from "../site-demo-1/art"
import type { SiteBook } from "../site-demo-1/data"
import { pagesOf } from "../site-demo-1/data"
import "./book3d.css"

/** `rz` (Spec site-awards-5, default 0) turns the book in its plane before the tilt */
export type Pose = { ry: number; rx: number; rz?: number; lift?: number; peek?: number }
export const thick = (b: SiteBook, s: number) => Math.max(12, (0.6 + (pagesOf(b) / 2) * 0.1) * s)
export const SPINE_SHADE = "linear-gradient(90deg, rgb(0 0 0/.16), rgb(0 0 0/0) 28%, rgb(255 255 255/.07) 55%, rgb(0 0 0/.12))"

/** `perspective` (px, default 1400) and `className` on the root (Spec site-awards-5, demo 5's packed row) */
export type Book3DProps = { b: SiteBook; s: number; pose?: Pose; floor?: boolean; perspective?: number; className?: string }
export const Book3DCss = React.forwardRef<HTMLDivElement, Book3DProps>(function Book3DCss({ b, s, pose, floor = true, perspective, className }, ref) {
  const W = b.w * s, H = b.h * s, T = thick(b, s)
  const bt = Math.max(1.5, 0.25 * s), sq = Math.max(1.5, 0.3 * s)
  const vars = { "--t2": `${T / 2}px`, "--bt": `${bt}px`, "--sq": `${sq}px`, "--board": b.spine, ...(pose && { "--ry": pose.ry, "--rx": pose.rx, "--rz": pose.rz ?? 0, "--lift": pose.lift ?? 0, "--peek": pose.peek ?? 0 }) } as React.CSSProperties
  return (
    <div ref={ref} className={`sd-b3wrap sd-pose sd-ring${className ? ` ${className}` : ""}`} style={{ width: W, height: H, ...(perspective && { perspective }), ...vars }} data-testid="book3d" data-book={b.id}>
      {floor && <div className="sd-floor" style={{ left: -W * 0.1 + T / 2, width: W * 1.2, bottom: -16, height: 28 }} />}
      {floor && <div className="sd-contact" style={{ left: W * 0.02 + T / 4, width: W, bottom: -4, height: Math.max(6, T / 2) }} />}
      <div className="sd-b3" style={{ width: W, height: H }}>
        <div style={{ left: 0, top: 0, width: W, height: H, background: b.spine, transform: `translateZ(${-T / 2}px) rotateY(180deg)` }} />
        <div className="sd-b3-spine" data-testid="book3d-spine" style={{ width: T, height: H, left: (W - T) / 2, top: 0, background: `${SPINE_SHADE}, linear-gradient(rgb(0 0 0/.06), rgb(0 0 0/.06)), ${b.spine}`, transform: `rotateY(-90deg) translateZ(${W / 2}px)` }}>
          {s > 4 && <span className="sd-it b3-spine-t" style={{ fontSize: Math.max(7, Math.min(13, T * 0.5)), color: b.spineInk }}>{b.title}</span>}
        </div>
        <div className="sd-b3-fore" data-testid="book3d-fore" style={{ width: T, height: H, left: (W - T) / 2, top: 0, transform: `rotateY(90deg) translateZ(${W / 2}px)` }} />
        <div className="sd-b3-top" data-testid="book3d-head" style={{ width: W, height: T, left: 0, top: (H - T) / 2, transform: `rotateX(90deg) translateZ(${H / 2}px)` }} />
        <div className="sd-b3-page" style={{ left: 0, top: sq, width: W - sq, height: H - 2 * sq, transform: `translateZ(${T / 2 - bt}px)` }} />
        <div className="sd-b3-cover overflow-hidden">
          <CoverFace b={b} w={W} h={H} />
          {s >= 6 && <div className="sd-b3-groove" style={{ left: 0.8 * s }} />}
        </div>
      </div>
    </div>
  )
})
