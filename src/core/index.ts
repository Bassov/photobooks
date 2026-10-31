export {
  CURRENT_SCHEMA_VERSION,
  bookSchema,
  type Asset,
  type Book,
  type Cover,
  type CoverPanel,
  type Endpaper,
  type Endpapers,
  type Frame,
  type FrameStyle,
  type Spread,
  type TextContent,
  type TextStyleId,
  TEXT_STYLE_IDS,
} from './schema'
export {
  isTextFrame,
  resolveTextItems,
  type ResolvedTextItem,
} from './text/resolveText'
export {
  defaultCover,
  defaultCoverStyle,
  defaultEndpapers,
  type CoverPanelName,
} from './cover'
export {
  COVER_FINISHES,
  COVER_MATERIALS,
  COVER_TITLE_FONTS,
  SPINE_DIRECTIONS,
  SPINE_WIDTH_MAX_MM,
  SPINE_WIDTH_MIN_MM,
  type CoverStyle,
  type FrameAdjust,
} from './schema'
export { TRIM_MAX_MM, TRIM_MIN_MM } from './ops/bookSettings'
export {
  frameStylePresets,
  noAdjust,
  frameStyleName,
  isAdjusted,
} from './ops/frameLook'
export { migrateToCurrent, type MigrateResult } from './migrate'
export {
  checkBookInvariants,
  type InvariantViolation,
  type InvariantsResult,
} from './invariants'
export { parseBook, serializeBook, type ParseResult } from './parse'
export { updateFrame, updateSpread } from './update'
export {
  GRID_COUNT_MAX,
  GRID_COUNT_MIN,
  GRID_FIELDS,
  effectiveGrid,
  hasGridOverride,
  resolveLayoutGrid,
  type PageGrid,
  type ResolvedLayoutGrid,
  type GridField,
  type GridPatch,
  type GridSource,
  type GridValues,
} from './grid/layoutGrid'

export {
  getPageCuts,
  getSpreadPageCount,
  getSpreadSizeMm,
} from './geometry/spreadSize'
export { DPI_MIN, DPI_WARN, frameDpi, lowDpi } from './geometry/dpi'
export {
  clampCrop,
  MAX_CROP_ZOOM,
  shownCropRect,
  sourceCropRect,
} from './geometry/cropRect'
export { COVER_CROP, resetCrop, setCrop, setFit } from './ops/crop'
export {
  resolveSpread,
  type ResolveSpreadOptions,
} from './geometry/resolveSpread'
export type {
  AspectRatioLookup,
  NormalizedRect,
  PageCut,
  RectMm,
  ResolvedFrameStyle,
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
  type FixedTemplateId,
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
  duplicateSpread,
  moveSpread,
  resolveAddSpreadTemplateId,
} from './ops/spreads'
export {
  MIN_FRAME_EDGE_MM,
  addFrame,
  nextFrameId,
  removeFrames,
  setFrameRect,
} from './ops/frames'
export {
  layerOf,
  reorderFrame,
  setFrameLocked,
  type ZMove,
} from './ops/arrange'
export {
  alignFrames,
  distributeFrames,
  moveFrame,
  resizeFrame,
  rotateFrame,
  type AlignEdge,
  type DistributeAxis,
} from './ops/transform'
export { fillSpread, insertSpreadWithAssets } from './ops/fill'
export {
  GUIDE_OVERSHOOT_MM,
  addGuide,
  moveGuide,
  nextGuideId,
  removeGuide,
  type Guide,
} from './ops/guides'
export { applyBookOp, type BookOp } from './ops/applyBookOp'

export {
  bookHasAnyPlacement,
  placementCountByAsset,
  unplacedAssetIds,
} from './selectors/placements'
