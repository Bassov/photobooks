export const TEMPLATE_IDS = [
  'full-bleed',
  'one-per-page',
  '2-up',
  '4-grid',
  'two-portraits',
  'landscape-two-portraits',
] as const

export type FixedTemplateId = (typeof TEMPLATE_IDS)[number]
export type ContactSheetId = `contact-${number}x${number}`
export type TemplateId = FixedTemplateId | ContactSheetId

export const CONTACT_MAX_COLS = 5
export const CONTACT_MAX_ROWS = 4

export function contactSheetId(cols: number, rows: number): ContactSheetId {
  return `contact-${String(cols)}x${String(rows)}` as ContactSheetId
}

export function parseContactSheetId(
  value: string,
): { cols: number; rows: number } | null {
  const match = /^contact-([1-9]\d*)x([1-9]\d*)$/.exec(value)
  if (match === null) {
    return null
  }
  const cols = Number(match[1])
  const rows = Number(match[2])
  if (cols > CONTACT_MAX_COLS || rows > CONTACT_MAX_ROWS) {
    return null
  }
  return { cols, rows }
}

export function isTemplateId(value: string): value is TemplateId {
  return (
    (TEMPLATE_IDS as readonly string[]).includes(value) ||
    parseContactSheetId(value) !== null
  )
}
