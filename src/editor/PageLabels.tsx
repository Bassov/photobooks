import { pageLabelTexts } from './pageLabelsModel'

export function PageLabels({
  spreadIndex,
  pages = 2,
  side = null,
  gapPx,
}: {
  spreadIndex: number
  pages?: 1 | 2
  /** A single page on its half of a spread-wide slot keeps the empty half. */
  side?: 'left' | 'right' | null
  /** Stack gap in layout px; a live zoom scales it (usePasteboardCamera). */
  gapPx: number
}) {
  const [left, right] = pageLabelTexts(spreadIndex, pages)
  return (
    <div
      className="page-labels"
      data-testid="page-labels"
      data-pages={pages}
      data-page-side={side ?? undefined}
      data-gap-px={gapPx}
      data-camera-frame=""
      aria-hidden="true"
    >
      <span className="page-label">{left}</span>
      <span className="page-label">{right}</span>
    </div>
  )
}
