/** Title for listings; missing or non-string document title → "". */
export function bookTitleFromUnknown(raw: unknown): string {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return ''
  }
  if (!('title' in raw)) {
    return ''
  }
  return typeof raw.title === 'string' ? raw.title : ''
}
