import type { TemplateId } from '../core'
import { dispatchBookOp } from './bookStore'

export function applyMarkedSpreadTemplate(
  spreadId: string | null,
  templateId: TemplateId,
): void {
  if (spreadId === null) {
    return
  }
  dispatchBookOp({
    type: 'applyTemplate',
    spreadId,
    templateId,
  })
}
