import { memo } from 'react'
import type { PageShadowRect } from './pageShadowModel'

/**
 * Kit `shadow-page` under each mounted spread, on a layer outside the zoom
 * transform: a live gesture moves and sizes the boxes through the camera
 * frame vars, so blur and offset stay in screen px.
 */
export const PageShadows = memo(function PageShadows({
  originPx,
  rects,
}: {
  originPx: number
  rects: readonly PageShadowRect[]
}) {
  return (
    <div
      className="pasteboard-shadows"
      data-testid="pasteboard-shadows"
      data-camera-frame=""
      aria-hidden="true"
      style={{ ['--cam-origin' as string]: `${String(originPx)}px` }}
    >
      {rects.map((rect) => (
        <div
          key={rect.spreadId}
          className="pasteboard-page-shadow"
          data-testid="pasteboard-page-shadow"
          data-spread-id={rect.spreadId}
          style={{
            ['--u' as string]: `${String(rect.u)}px`,
            ['--v' as string]: `${String(rect.v)}px`,
            ['--w' as string]: `${String(rect.w)}px`,
            ['--h' as string]: `${String(rect.h)}px`,
          }}
        />
      ))}
    </div>
  )
})
