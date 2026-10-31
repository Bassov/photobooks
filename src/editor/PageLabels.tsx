import { pageLabelTexts } from './pageLabelsModel'

export function PageLabels({
  spreadIndex,
  pages = 2,
  gapPx,
}: {
  spreadIndex: number
  pages?: 1 | 2
  /** Stack gap in layout px; a live zoom scales it (usePasteboardCamera). */
  gapPx: number
}) {
  const [left, right] = pageLabelTexts(spreadIndex, pages)
  return (
    <div
      className="page-labels"
      data-testid="page-labels"
      data-pages={pages}
      data-gap-px={gapPx}
      data-camera-frame=""
      aria-hidden="true"
    >
      <span className="page-label">{left}</span>
      <span className="page-label">{right}</span>
    </div>
  )
}
