export {
  CURRENT_SCHEMA_VERSION,
  bookSchema,
  type Asset,
  type Book,
  type Frame,
  type Spread,
} from './schema'
export { migrateToCurrent, type MigrateResult } from './migrate'
export {
  checkBookInvariants,
  type InvariantViolation,
  type InvariantsResult,
} from './invariants'
export { parseBook, serializeBook, type ParseResult } from './parse'
export { updateFrame, updateSpread } from './update'

export {
  getPageCuts,
  getSpreadPageCount,
  getSpreadSizeMm,
} from './geometry/spreadSize'
export { sourceCropRect } from './geometry/cropRect'
export {
  resolveSpread,
  type ResolveSpreadOptions,
} from './geometry/resolveSpread'
export type {
  AspectRatioLookup,
  NormalizedRect,
  PageCut,
  RectMm,
  ResolvedItem,
  ResolvedSpread,
} from './geometry/types'

export { TEMPLATE_IDS, isTemplateId, type TemplateId } from './templates/types'
export { generateTemplateFrames, frameIdFor } from './templates/catalog'
export { applyTemplate } from './templates/apply'

export { addToGallery, removeFromGallery } from './ops/gallery'
export { placeAsset, replaceAsset, unplaceAsset, swapFrames } from './ops/place'
export {
  addSpread,
  removeSpread,
  moveSpread,
  resolveAddSpreadTemplateId,
} from './ops/spreads'
export { applyBookOp, type BookOp } from './ops/applyBookOp'

export {
  bookHasAnyPlacement,
  placementCountByAsset,
  unplacedAssetIds,
} from './selectors/placements'
