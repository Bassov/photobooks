import { pageLabelTexts } from './pageLabelsModel'

export function PageLabels({
  spreadIndex,
  pages = 2,
}: {
  spreadIndex: number
  pages?: 1 | 2
}) {
  const [left, right] = pageLabelTexts(spreadIndex, pages)
  return (
    <div
      className="page-labels"
      data-testid="page-labels"
      data-pages={pages}
      aria-hidden="true"
    >
      <span className="page-label">{left}</span>
      <span className="page-label">{right}</span>
    </div>
  )
}
