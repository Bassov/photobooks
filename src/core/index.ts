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
export { clampCrop, MAX_CROP_ZOOM, sourceCropRect } from './geometry/cropRect'
export { COVER_CROP, resetCrop, setCrop } from './ops/crop'
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

export {
  TEMPLATE_IDS,
  CONTACT_MAX_COLS,
  CONTACT_MAX_ROWS,
  contactSheetId,
  isTemplateId,
  parseContactSheetId,
  type TemplateId,
} from './templates/types'
export {
  photoAspectClass,
  slotAspect,
  templateSlotAspects,
  type AspectClass,
} from './templates/aspect'
export { bestTemplateId } from './templates/best'
export { generateTemplateFrames, frameIdFor } from './templates/catalog'
export { applyTemplate } from './templates/apply'

export {
  addToGallery,
  removeFromGallery,
  removeManyFromGallery,
} from './ops/gallery'
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
