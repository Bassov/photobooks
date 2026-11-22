import type { TemplateId } from '../core'
import { dispatchBookOp } from './bookStore'

export function applyMarkedSpreadTemplate(
  spreadId: string | null,
  templateId: TemplateId,
  step: { historyKey?: string; label?: string } = {},
): void {
  if (spreadId === null) {
    return
  }
  dispatchBookOp(
    {
      type: 'applyTemplate',
      spreadId,
      templateId,
    },
    step.historyKey,
    step.label,
  )
}
