import { parseBook, type Book } from '../../core'

export interface BookLoadRequest {
  id: string
  text: string
}

export type BookLoadResponse =
  | { ok: true; id: string; book: Book }
  | { ok: false; id: string; code: 'corrupted' | 'newer-schema' }

export function processBookLoadRequest(
  request: BookLoadRequest,
): BookLoadResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(request.text) as unknown
  } catch {
    return { ok: false, id: request.id, code: 'corrupted' }
  }

  const result = parseBook(parsed)
  if (!result.ok) {
    if (result.code === 'newer-schema') {
      return { ok: false, id: request.id, code: 'newer-schema' }
    }
    return { ok: false, id: request.id, code: 'corrupted' }
  }
  return { ok: true, id: request.id, book: result.book }
}
