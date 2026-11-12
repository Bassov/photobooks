/*
 * The closed book on the home (Designer personal-site P4; port of the kit's
 * `site-book/book3d-css.tsx` + the GL hookup of `book3d.tsx`): the CSS
 * hardcover is prerendered; after `load` and the first idle `book3dGl.ts`
 * draws the GL book over it in place (D42). `?gl=0`, no WebGL2 or a failure
 * keep the CSS book. `s` = px per cm.
 */
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { shelfBook, thickCm } from '../shelf'
import type { SiteCatalogBook } from '../siteInput'
import { afterLoadIdle } from './afterLoadIdle'

/** the CSS tilt (kit `book3d.css` vars) */
export interface CssPose {
  ry: number
  rx: number
}

const SPINE_SHADE =
  'linear-gradient(90deg, rgb(0 0 0/.16), rgb(0 0 0/0) 28%, rgb(255 255 255/.07) 55%, rgb(0 0 0/.12))'

/** after load + idle, the GL book replaces the CSS faces of `host` (until `b` / `s` change) */
function useGlBook(
  host: RefObject<HTMLDivElement | null>,
  b: SiteCatalogBook,
  s: number,
) {
  useEffect(() => {
    let live = true
    let undo: () => void = () => undefined
    void afterLoadIdle()
      .then(() => import('./book3dGl'))
      .then((m) => {
        const el = host.current
        if (!live || el === null) return
        return m.drawHomeBook(el, b, s).then((u) => {
          if (live) undo = u
          else u()
        })
      })
      .catch(() => undefined)
    return () => {
      live = false
      undo()
    }
  }, [host, b, s])
}

export function Book3D({
  b,
  s,
  pose,
}: {
  b: SiteCatalogBook
  s: number
  pose: CssPose
}) {
  const host = useRef<HTMLDivElement>(null)
  useGlBook(host, b, s)
  const W = (b.trimMm.w / 10) * s
  const H = (b.trimMm.h / 10) * s
  const T = Math.max(12, thickCm(shelfBook(b)) * s)
  const bt = Math.max(1.5, 0.25 * s)
  const sq = Math.max(1.5, 0.3 * s)
  const vars = {
    '--t2': `${String(T / 2)}px`,
    '--bt': `${String(bt)}px`,
    '--sq': `${String(sq)}px`,
    '--board': b.spine.cloth,
    '--paper': b.paper,
    '--ry': pose.ry,
    '--rx': pose.rx,
  } as CSSProperties
  return (
    <div
      ref={host}
      className="sd-b3wrap"
      style={{ width: W, height: H, ...vars }}
      data-testid="book3d"
      data-book={b.id}
    >
      <div className="sd-b3" style={{ width: W, height: H }}>
        <div
          style={{
            left: 0,
            top: 0,
            width: W,
            height: H,
            background: b.spine.cloth,
            transform: `translateZ(${String(-T / 2)}px) rotateY(180deg)`,
          }}
        />
        <div
          className="sd-b3-spine"
          style={{
            width: T,
            height: H,
            left: (W - T) / 2,
            top: 0,
            background: `${SPINE_SHADE}, linear-gradient(rgb(0 0 0/.06), rgb(0 0 0/.06)), ${b.spine.cloth}`,
            transform: `rotateY(-90deg) translateZ(${String(W / 2)}px)`,
          }}
        >
          <span
            className="sd-it"
            style={{
              fontSize: Math.max(7, Math.min(13, T * 0.5)),
              color: b.spine.ink,
            }}
          >
            {b.spine.text}
          </span>
        </div>
        <div
          className="sd-b3-fore"
          style={{
            width: T,
            height: H,
            left: (W - T) / 2,
            top: 0,
            transform: `rotateY(90deg) translateZ(${String(W / 2)}px)`,
          }}
        />
        <div
          className="sd-b3-top"
          style={{
            width: W,
            height: T,
            left: 0,
            top: (H - T) / 2,
            transform: `rotateX(90deg) translateZ(${String(H / 2)}px)`,
          }}
        />
        <div
          className="sd-b3-page"
          style={{
            left: 0,
            top: sq,
            width: W - sq,
            height: H - 2 * sq,
            transform: `translateZ(${String(T / 2 - bt)}px)`,
          }}
        />
        <div className="sd-b3-cover" style={{ background: b.spine.cloth }}>
          {b.cover === null ? null : (
            <img src={b.cover.src} alt="" decoding="async" />
          )}
          <div className="sd-b3-hinge" style={{ width: Math.max(8, H / 30) }} />
          <div
            className="sd-it sd-b3-title"
            style={{
              color: b.ink,
              fontSize: `calc(var(--cover-k) * ${String(Math.min(W, H))}px)`,
              [b.place]: '9%',
            }}
          >
            {b.title}
          </div>
          {s >= 6 ? (
            <div className="sd-b3-groove" style={{ left: 0.8 * s }} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
