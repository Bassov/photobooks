import { useEffect, useRef, useState, type CSSProperties } from 'react'

/** The layer hides this long after the pointer leaves the photo. */
const HIDE_DELAY_MS = 400
/** Pointer distance (px) outside the photo that still counts as on it. */
const HIDE_SLOP_PX = 12

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const

/**
 * Designer walkthrough-ux-review §A (direct crop) on a selected photo frame:
 * the photo layer (ghost .3 + extent outline), the content grabber, the 4
 * corner photo handles and the gesture tag. Layer and handles stay mounted
 * and hidden (no hits) until the grabber or a photo handle is hovered, or a
 * photo gesture runs (`data-photo-gesture` on the frame, src/editor/
 * photoGesture.ts); they hide 400 ms after the pointer is > 12 px outside the
 * photo. `data-photo-box` boxes follow the gesture preview with the photo.
 */
export function PhotoChrome({
  src,
  box,
  grabber,
}: {
  src: string
  /** The photo's box in the frame (the image style without its filter). */
  box: CSSProperties
  /** Grabber point, % of the frame. */
  grabber: { x: number; y: number }
}) {
  const [shown, setShown] = useState(false)
  const extent = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!shown) {
      return
    }
    let timer: number | undefined
    const onMove = (event: PointerEvent): void => {
      const rect = extent.current?.getBoundingClientRect()
      if (rect === undefined) {
        return
      }
      const away = Math.hypot(
        Math.max(rect.left - event.clientX, 0, event.clientX - rect.right),
        Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom),
      )
      if (away <= HIDE_SLOP_PX) {
        window.clearTimeout(timer)
        timer = undefined
      } else {
        timer ??= window.setTimeout(() => {
          setShown(false)
        }, HIDE_DELAY_MS)
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.clearTimeout(timer)
    }
  }, [shown])
  const show = (): void => {
    setShown(true)
  }
  const state = shown ? 'true' : undefined
  return (
    <>
      <span
        className="spread-frame-photo-layer"
        data-testid="photo-layer"
        data-shown={state}
        aria-hidden
      >
        <span
          className="spread-frame-photo-ghost"
          data-testid="photo-ghost"
          data-photo-box=""
          style={{ ...box, backgroundImage: `url("${src}")` }}
        />
        <span
          ref={extent}
          className="spread-frame-photo-extent"
          data-testid="photo-extent"
          data-photo-box=""
          data-photo-pan=""
          style={box}
        />
      </span>
      <span
        className="spread-frame-grabber"
        data-testid="crop-grabber"
        data-photo-pan=""
        data-camera-frame=""
        title="Drag to move the photo"
        aria-hidden
        style={
          {
            '--grab-x': `${String(grabber.x)}%`,
            '--grab-y': `${String(grabber.y)}%`,
          } as CSSProperties
        }
        onPointerEnter={show}
      />
      <span
        className="spread-frame-photo-handles"
        data-testid="photo-handles"
        data-shown={state}
        aria-hidden
      >
        <span className="spread-frame-photo-box" data-photo-box="" style={box}>
          {CORNERS.map((corner) => (
            <span
              key={corner}
              className="spread-frame-photo-handle"
              data-testid="photo-handle"
              data-photo-handle={corner}
              data-camera-frame=""
              onPointerEnter={show}
            />
          ))}
        </span>
      </span>
      <span
        className="spread-frame-crop-tag spread-frame-photo-tag"
        data-testid="photo-crop-tag"
        data-camera-frame=""
      >
        Crop
      </span>
    </>
  )
}
