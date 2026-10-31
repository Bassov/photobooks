import { omitKey } from '../omitKey'
import type { Book, SpreadMasterId } from '../schema'
import { updateSpread } from '../update'

/** Kit Background: the spread's own color; `undefined` → the page default. */
export function setSpreadBackground(
  book: Book,
  spreadId: string,
  color: string | undefined,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    if (spread.backgroundColor === color) {
      return spread
    }
    const rest = omitKey(spread, 'backgroundColor')
    return color === undefined ? rest : { ...rest, backgroundColor: color }
  })
}

/** Kit Master & spacing: Master A is the default and is stored as absent. */
export function setSpreadMaster(
  book: Book,
  spreadId: string,
  masterId: SpreadMasterId,
): Book {
  return updateSpread(book, spreadId, (spread) => {
    if ((spread.masterId ?? 'A') === masterId) {
      return spread
    }
    const rest = omitKey(spread, 'masterId')
    return masterId === 'A' ? rest : { ...rest, masterId }
  })
}
