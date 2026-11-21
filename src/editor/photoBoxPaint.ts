import { sourceCropRect, type Frame } from '../core'
import { imageCropBox } from '../render/frameBox'
import { turnedPhotoStyle } from '../render/photoLayout'

/** The frame's photos (clipped + ghost) and its photo-layer boxes. */
const BOX_SELECTOR = 'img.spread-frame-image, [data-photo-box]'

type PhotoFrame = Pick<Frame, 'rect' | 'crop' | 'fit'>

export interface PhotoBoxPainter {
  /** Lay the photo out for `frame` (its rect in mm, its crop and fit). */
  paint: (frame: PhotoFrame) => void
  /** Back to the React-owned styles. */
  restore: () => void
}

/**
 * Live preview of a photo's box on a frame button (direct crop): the same
 * layout the painter derives from a committed crop, written to the photos and
 * the photo-layer boxes, so the preview matches the commit.
 */
export function photoBoxPainter(
  button: HTMLElement,
  aspect: number,
  layoutPxPerMm: number,
): PhotoBoxPainter {
  const targets = Array.from(button.querySelectorAll<HTMLElement>(BOX_SELECTOR))
  const saved = targets.map((el) => el.style.cssText)
  return {
    paint: ({ rect, crop, fit }) => {
      const window = sourceCropRect(rect, crop, aspect, fit)
      const quarterTurns = crop?.quarterTurns ?? 0
      const straightenDeg = crop?.straightenDeg ?? 0
      const flip = { h: crop?.flipH === true, v: crop?.flipV === true }
      const turned = quarterTurns > 0 || straightenDeg !== 0 || flip.h || flip.v
      const box = turned
        ? turnedPhotoStyle(
            {
              width: rect.width * layoutPxPerMm,
              height: rect.height * layoutPxPerMm,
            },
            window,
            quarterTurns,
            straightenDeg,
            flip,
          )
        : imageCropBox(window)
      for (const { style } of targets) {
        style.left = px(box.left)
        style.top = px(box.top)
        style.width = px(box.width)
        style.height = px(box.height)
        if ('transform' in box) {
          style.transform = box.transform
        }
      }
    },
    restore: () => {
      targets.forEach((el, i) => {
        el.style.cssText = saved[i] ?? ''
      })
    },
  }
}

function px(value: number | string): string {
  return typeof value === 'number' ? `${String(value)}px` : value
}
