import { pageLabelTexts } from './pageLabelsModel'

export function PageLabels({ spreadIndex }: { spreadIndex: number }) {
  const [left, right] = pageLabelTexts(spreadIndex)
  return (
    <div className="page-labels" data-testid="page-labels" aria-hidden="true">
      <span className="page-label">{left}</span>
      <span className="page-label">{right}</span>
    </div>
  )
}
