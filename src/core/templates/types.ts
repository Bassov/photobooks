export const TEMPLATE_IDS = [
  'full-bleed',
  'one-per-page',
  '2-up',
  '4-grid',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

export function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value)
}
