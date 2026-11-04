/* Book3D (Spec site-awards): a hardcover at its true relative size — cover, spine with the title, page block, back and a
   floor shadow — in a CSS 3D box. `s` = px per cm. The pose comes from the nearest `.sd-host` (hover / focus / active) or
   from `pose` (the hero, which follows the pointer). */
import * as React from "react"
import { CoverFace } from "./art"
import type { SiteBook } from "./data"
import { pagesOf } from "./data"

/** `rz` (Spec site-awards-5, default 0) turns the book in its plane before the tilt */
export type Pose = { ry: number; rx: number; rz?: number; lift?: number; peek?: number }
export const thick = (b: SiteBook, s: number) => Math.max(12, (0.6 + (pagesOf(b) / 2) * 0.1) * s)
export const SPINE_SHADE = "linear-gradient(90deg, rgb(0 0 0/.16), rgb(0 0 0/0) 28%, rgb(255 255 255/.07) 55%, rgb(0 0 0/.12))"

/** `perspective` (px, default 1800) and `className` on the root (Spec site-awards-5, demo 5's packed row) */
export const Book3D = React.forwardRef<HTMLDivElement, { b: SiteBook; s: number; pose?: Pose; floor?: boolean; perspective?: number; className?: string }>(function Book3D({ b, s, pose, floor = true, perspective, className }, ref) {
  const W = b.w * s, H = b.h * s, T = thick(b, s)
  const vars = { "--t2": `${T / 2}px`, ...(pose && { "--ry": pose.ry, "--rx": pose.rx, "--rz": pose.rz ?? 0, "--lift": pose.lift ?? 0, "--peek": pose.peek ?? 0 }) } as React.CSSProperties
  return (
    <div ref={ref} className={`sd-b3wrap sd-pose sd-ring${className ? ` ${className}` : ""}`} style={{ width: W, height: H, ...(perspective && { perspective }), ...vars }} data-testid="book3d" data-book={b.id}>
      {floor && <div className="sd-floor" style={{ left: -W * 0.08, width: W * 1.16, bottom: -16, height: 28 }} />}
      <div className="sd-b3" style={{ width: W, height: H }}>
        <div style={{ left: 0, top: 0, width: W, height: H, background: b.spine, transform: `translateZ(${-T / 2}px) rotateY(180deg)` }} />
        <div className="sd-b3-spine" style={{ width: T, height: H, left: (W - T) / 2, top: 0, background: `${SPINE_SHADE}, ${b.spine}`, transform: `rotateY(-90deg) translateZ(${W / 2}px)` }}>
          <span className="sd-it b3-spine-t" style={{ fontSize: Math.max(11, Math.min(13, T * 0.5)), color: b.spineInk }}>{b.title}</span>
        </div>
        <div className="sd-b3-fore" style={{ width: T - 4, height: H - 6, left: (W - T + 4) / 2, top: 3, transform: `rotateY(90deg) translateZ(${W / 2 - 3}px)` }} />
        <div className="sd-b3-top" style={{ width: W - 3, height: T - 4, left: 0, top: (H - T + 4) / 2, transform: `rotateX(90deg) translateZ(${H / 2 - 3}px)` }} />
        <div className="sd-b3-page" style={{ left: 0, top: 3, width: W - 3, height: H - 6, transform: `translateZ(${T / 2 - 2}px)` }} />
        <div className="sd-b3-cover overflow-hidden"><CoverFace b={b} w={W} h={H} /></div>
      </div>
    </div>
  )
})
