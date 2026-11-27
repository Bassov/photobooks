import React from 'react'
// The product's own print geometry (read only): boxes, crop marks 3 → 8 mm outside the trim, cover fold marks.
import {
  CROP_MARK_WIDTH_PT,
  PT_PER_MM,
  coverSheetMarks,
  cropMarkSegments,
  sheetBoxes,
} from '../../../../../src/core/pdf/pdfGeometry.ts'

/** Generic print profile bleed (mm). */
export const PDF_BLEED_MM = 3

/** Media size in px of a `trimW × trimH` mm sheet with crop marks. */
export function pdfSheetSize(trimW, trimH, pxPerMm, bleed = PDF_BLEED_MM) {
  const { slugMm } = sheetBoxes(trimW, trimH, bleed, true)
  return {
    w: (trimW + 2 * slugMm) * pxPerMm,
    h: (trimH + 2 * slugMm) * pxPerMm,
    slugMm,
  }
}

/**
 * A PDF page built in Remotion (spec §2 «PDF sheet»): white media, the artwork (`children`, drawn into a box of the
 * bleed size) to the bleed box, black crop marks at max(0.25 pt × scale, 2 px); `cover = { spine, spineX }` (mm,
 * from the trim's left) adds the fold marks at the spine edges only. Flat, with a soft shadow; no tilt.
 */
export const PdfSheet = ({
  trimW,
  trimH,
  pxPerMm,
  bleed = PDF_BLEED_MM,
  cover,
  x = 0,
  y = 0,
  children,
}) => {
  const boxes = sheetBoxes(trimW, trimH, bleed, true)
  const slug = boxes.slugMm
  const mm = (pt) => (pt / PT_PER_MM) * pxPerMm
  const media = { w: mm(boxes.media.width), h: mm(boxes.media.height) }
  const art = {
    x: mm(boxes.bleed.x),
    y: mm(boxes.bleed.y),
    w: mm(boxes.bleed.width),
    h: mm(boxes.bleed.height),
  }
  const segments = cover
    ? coverSheetMarks(
        {
          sheetW: trimW,
          sheetH: trimH,
          spine: cover.spine,
          rects: { spine: { x: cover.spineX } },
        },
        bleed,
      )
    : cropMarkSegments({ x: 0, y: 0, width: trimW, height: trimH }, bleed)
  const stroke = Math.max(CROP_MARK_WIDTH_PT * (pxPerMm / PT_PER_MM), 2)
  const px = (v) => (v + slug) * pxPerMm
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: media.w,
        height: media.h,
        background: '#FFFFFF',
        boxShadow: '0 40px 80px -20px rgb(0 0 0 / 0.6)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: art.x,
          top: art.y,
          width: art.w,
          height: art.h,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
      <svg
        width={media.w}
        height={media.h}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {segments.map((s, k) => (
          <line
            key={k}
            x1={px(s.from.x)}
            y1={px(s.from.y)}
            x2={px(s.to.x)}
            y2={px(s.to.y)}
            stroke="#000"
            strokeWidth={stroke}
          />
        ))}
      </svg>
    </div>
  )
}
