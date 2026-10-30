import {
  createElement,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { ResolvedItem, ResolvedSpread } from '../core'

export interface FrameControl {
  label: string
  pressed?: boolean
  onActivate: () => void
  onDragStart?: (event: ReactDragEvent<HTMLDivElement>) => void
  /** Crop mode: unclipped dim ghost, no drag; the editor owns the gestures. */
  cropActive?: boolean
  /** Crop zoom (1 = cover) shown in the "Crop · N%" tag. */
  cropZoom?: number
  onDoubleActivate?: () => void
}
import { dropChipLabel } from './dropChip'
import { adjustFilter, frameStyleCss } from './frameLookCss'
import {
  clearPhotoPreview,
  PHOTO_LAYER_ATTR,
  turnedPhotoStyle,
} from './photoLayout'
import {
  frameBox,
  imageCropBox,
  pageCutLine,
  SPREAD_PX_PER_MM,
} from './frameBox'
import {
  missingAssetId,
  missingPlaceholderClass,
  missingPlaceholderTestId,
  previewUrlUnlessMissing,
  tierUnlessMissing,
} from './spreadMissing'
import { spreadFrameControlStyle } from './spreadChromeStyles'
import { ICON_GLYPHS } from '../ui/icons/glyphs'
import './SpreadView.css'

/** Keeps the crop-mode frame (and its ghost) above neighbouring frames. */
const CROP_Z_BOOST = 1000

const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const

/** Kit selection handles: corners + edge midpoints, % of the frame. */
const HANDLE_POINTS = [
  ['nw', '0%', '0%'],
  ['n', '50%', '0%'],
  ['ne', '100%', '0%'],
  ['w', '0%', '50%'],
  ['e', '100%', '50%'],
  ['sw', '0%', '100%'],
  ['s', '50%', '100%'],
  ['se', '100%', '100%'],
] as const

/** On-screen frame widths (px) where the kit shows the empty / missing hints. */
const FRAME_ICON_MIN_PX = 46
const FRAME_LABEL_MIN_PX = 110

type GlyphNodes = readonly (readonly [string, Record<string, string>])[]

/** Lucide `image-plus`; the in-repo icon set has no equivalent. */
const IMAGE_PLUS_GLYPH: GlyphNodes = [
  ['path', { d: 'M16 5h6' }],
  ['path', { d: 'M19 2v6' }],
  [
    'path',
    { d: 'M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5' },
  ],
  ['path', { d: 'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' }],
  ['circle', { cx: '9', cy: '9', r: '2' }],
]

/** Decorative chrome glyph at an exact px size (the Icon set has no 12). */
function FrameGlyph({
  nodes,
  size,
  name,
}: {
  nodes: GlyphNodes
  size: number
  name: string
}) {
  return (
    <svg
      className="spread-frame-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-glyph={name}
      aria-hidden
      focusable="false"
    >
      {nodes.map(([tag, attrs], i) =>
        createElement(tag, { ...attrs, key: `${tag}-${String(i)}` }),
      )}
    </svg>
  )
}

/** Gap between the frame and its caption (kit: 1.5 mm under the frame). */
const CAPTION_GAP_MM = 1.5

function sizeLabel(item: ResolvedItem): string {
  const round = (mm: number) => String(Math.round(mm * 10) / 10)
  return `${round(item.rectMm.width)} × ${round(item.rectMm.height)} mm`
}

export function SpreadView({
  spreadId,
  resolved,
  previewUrlFor,
  tierFor,
  frameControlFor,
  isMissingAsset,
  assetNameFor,
  pxPerMm = SPREAD_PX_PER_MM,
  thumb = false,
  overlay,
  lowDpiBadge = true,
}: {
  spreadId: string
  resolved: ResolvedSpread
  previewUrlFor: (assetId: string) => string | undefined
  tierFor?: (assetId: string) => number | undefined
  frameControlFor?: (item: ResolvedItem) => FrameControl
  /** When true, show hatched missing placeholder instead of a stale preview. */
  isMissingAsset?: (assetId: string) => boolean
  /** File name for the "‹name› not found" hint; falls back to "Photo". */
  assetNameFor?: (assetId: string) => string | undefined
  pxPerMm?: number
  /**
   * Inert list thumbnail: no test ids / data ids (so pasteboard selectors and
   * counts never match it) and no pointer events.
   */
  thumb?: boolean
  /** Editor-layer chrome (e.g. the layout grid) painted above the frames. */
  overlay?: ReactNode
  /** Editor-only low-resolution badge on controlled frames (off in Preview). */
  lowDpiBadge?: boolean
}) {
  return (
    <div
      className={thumb ? 'spread-view spread-view--thumb' : 'spread-view'}
      data-testid={thumb ? undefined : 'spread-view'}
      data-spread-id={thumb ? undefined : spreadId}
      aria-hidden={thumb ? true : undefined}
      style={{
        width: resolved.spreadWidthMm * pxPerMm,
        height: resolved.spreadHeightMm * pxPerMm,
        ...(resolved.backgroundColor === undefined
          ? {}
          : { background: resolved.backgroundColor }),
      }}
    >
      {resolved.items.map((item) => {
        const missingId = missingAssetId(item.assetId, isMissingAsset)
        const missing = missingId !== undefined
        return (
          <SpreadFrame
            key={item.frameId}
            item={item}
            pxPerMm={pxPerMm}
            thumb={thumb}
            lowDpiBadge={lowDpiBadge}
            missing={missing}
            assetName={
              missingId === undefined ? undefined : assetNameFor?.(missingId)
            }
            previewUrl={previewUrlUnlessMissing(
              missing,
              item.assetId,
              previewUrlFor,
            )}
            tier={tierUnlessMissing(missing, item.assetId, tierFor)}
            control={frameControlFor?.(item)}
          />
        )
      })}
      {resolved.pageCuts.map((cut) => {
        const line = pageCutLine(cut, pxPerMm)
        const vertical = line.orientation === 'vertical'
        return (
          <div
            key={`${line.orientation}:${String(line.offsetPx)}`}
            className="spread-page-cut"
            data-testid={thumb ? undefined : 'spread-page-cut'}
            data-orientation={line.orientation}
            aria-hidden="true"
            style={
              vertical
                ? {
                    left: line.offsetPx,
                    top: 0,
                    width: 1,
                    height: '100%',
                  }
                : {
                    left: 0,
                    top: line.offsetPx,
                    width: '100%',
                    height: 1,
                  }
            }
          />
        )
      })}
      {thumb ? null : overlay}
    </div>
  )
}

function SpreadFrame({
  item,
  previewUrl,
  tier,
  pxPerMm,
  control,
  missing,
  assetName,
  thumb,
  lowDpiBadge,
}: {
  assetName: string | undefined
  thumb: boolean
  lowDpiBadge: boolean
  item: ResolvedItem
  previewUrl: string | undefined
  tier: number | undefined
  pxPerMm: number
  control: FrameControl | undefined
  missing: boolean
}) {
  const box = frameBox(item.rectMm, pxPerMm)
  const crop = imageCropBox(item.sourceCropRect ?? FULL_CROP)
  const cropActive = control?.cropActive === true
  const bodyRef = useRef<HTMLDivElement>(null)
  // The committed crop replaces the rAF preview transform.
  const quarterTurns = item.photoQuarterTurns ?? 0
  const straightenDeg = item.straightenDeg ?? 0
  const turned = quarterTurns > 0 || straightenDeg !== 0
  useLayoutEffect(() => {
    if (bodyRef.current !== null) {
      clearPhotoPreview(bodyRef.current)
    }
  }, [
    crop.left,
    crop.top,
    crop.width,
    crop.height,
    quarterTurns,
    straightenDeg,
  ])
  const style = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    zIndex: cropActive ? item.z + CROP_Z_BOOST : item.z,
    ...(item.rotation === 0
      ? {}
      : { transform: `rotate(${String(item.rotation)}deg)` }),
  }
  const selected = control?.pressed === true && !cropActive
  const filter = adjustFilter(item.adjust)
  const imageStyle: CSSProperties = {
    ...(turned
      ? turnedPhotoStyle(
          { width: box.width, height: box.height },
          item.sourceCropRect ?? FULL_CROP,
          quarterTurns,
          straightenDeg,
        )
      : {
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        }),
    ...(filter === undefined ? {} : { filter }),
  }
  // A turned photo's transform is its layout; previews go on a wrapper.
  const layer = (img: ReactElement): ReactElement =>
    turned ? (
      <div className="spread-frame-layer" {...{ [PHOTO_LAYER_ATTR]: '' }}>
        {img}
      </div>
    ) : (
      img
    )
  // Kit hints are editor chrome: only frames with a control (never thumbs).
  const showHints = control !== undefined
  const showIcon = showHints && box.width > FRAME_ICON_MIN_PX
  const showLabel = showHints && box.width > FRAME_LABEL_MIN_PX
  const image =
    previewUrl === undefined ? (
      <div
        className={missingPlaceholderClass(missing)}
        data-testid={thumb ? undefined : missingPlaceholderTestId(missing)}
      >
        {missing ? (
          <>
            {showHints ? (
              <FrameGlyph
                nodes={ICON_GLYPHS.warning}
                size={16}
                name="warning"
              />
            ) : null}
            {showLabel ? (
              <span
                className="spread-frame-hint spread-frame-hint--missing"
                data-testid="frame-missing-label"
              >
                {assetName ?? 'Photo'} not found
              </span>
            ) : null}
          </>
        ) : (
          <>
            {showIcon ? (
              <FrameGlyph
                nodes={IMAGE_PLUS_GLYPH}
                size={16}
                name="image-plus"
              />
            ) : null}
            {showLabel ? (
              <span
                className="spread-frame-hint"
                data-testid="frame-empty-label"
              >
                Drop photo
              </span>
            ) : null}
          </>
        )}
      </div>
    ) : (
      layer(
        <img
          className="spread-frame-image"
          data-testid={thumb ? undefined : 'spread-frame-image'}
          alt=""
          decoding="async"
          src={previewUrl}
          data-tier={tier}
          style={imageStyle}
        />,
      )
    )
  // Stay mounted when a frame empties mid-drop so dragend still reaches document.
  // A draggable element inside a button is invalid HTML; Chromium still drags it.
  const body = (
    <div
      ref={bodyRef}
      className="spread-frame-body"
      style={frameStyleCss(item.style, pxPerMm)}
      data-frame-style={item.style === undefined ? undefined : 'true'}
      draggable={!cropActive && !selected && control?.onDragStart !== undefined}
      onDragStart={control?.onDragStart}
    >
      {cropActive && previewUrl !== undefined ? (
        <>
          {layer(
            <img
              className="spread-frame-image spread-frame-ghost"
              data-testid="spread-frame-ghost"
              alt=""
              aria-hidden
              src={previewUrl}
              style={imageStyle}
            />,
          )}
          <div className="spread-frame-clip">{image}</div>
        </>
      ) : (
        image
      )}
    </div>
  )
  const captionNode =
    item.caption === undefined ? null : (
      <span
        className="spread-frame-caption"
        data-testid={thumb ? undefined : 'frame-caption'}
        style={{ top: `calc(100% + ${String(CAPTION_GAP_MM * pxPerMm)}px)` }}
      >
        {item.caption}
      </span>
    )
  if (control === undefined) {
    return (
      <div
        className="spread-frame"
        data-testid={thumb ? undefined : 'spread-frame'}
        data-frame-id={thumb ? undefined : item.frameId}
        data-filled={item.assetId === undefined ? 'false' : 'true'}
        data-drop-label={
          thumb ? undefined : dropChipLabel(item.assetId !== undefined)
        }
        data-asset-id={thumb ? undefined : item.assetId}
        style={style}
      >
        {body}
        {captionNode}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="spread-frame"
      data-testid="spread-frame"
      data-frame-id={item.frameId}
      data-filled={item.assetId === undefined ? 'false' : 'true'}
      data-drop-label={dropChipLabel(item.assetId !== undefined)}
      data-asset-id={item.assetId}
      data-crop-active={cropActive ? 'true' : undefined}
      data-locked={item.locked === true ? 'true' : undefined}
      aria-label={control.label}
      aria-pressed={control.pressed === true ? true : undefined}
      style={spreadFrameControlStyle(style, control.pressed === true)}
      onClick={control.onActivate}
      onDoubleClick={control.onDoubleActivate}
    >
      {body}
      {captionNode}
      {cropActive ? (
        <span className="spread-frame-crop-tag" data-testid="crop-overlay-tag">
          Crop · {Math.round((control.cropZoom ?? 1) * 100)}%
        </span>
      ) : null}
      {item.locked === true ? (
        <span
          className="spread-frame-lock"
          data-testid="frame-lock-badge"
          aria-hidden
        >
          <FrameGlyph nodes={ICON_GLYPHS.lock} size={12} name="lock" />
        </span>
      ) : null}
      {item.lowDpi !== undefined && !missing && !thumb && lowDpiBadge ? (
        <span
          className="spread-frame-dpi"
          data-testid="dpi-badge"
          data-level={item.lowDpi.level}
          aria-label={`Low resolution, ${String(item.lowDpi.dpi)} dpi`}
        >
          <FrameGlyph nodes={ICON_GLYPHS.warning} size={10} name="warning" />
          {item.lowDpi.dpi} dpi
        </span>
      ) : null}
      {selected && item.locked !== true ? (
        <>
          <span
            className="spread-frame-handles"
            data-testid="spread-frame-handles"
            aria-hidden
          >
            {HANDLE_POINTS.map(([id, x, y]) => (
              <span
                key={id}
                className="spread-frame-handle"
                data-handle={id}
                data-testid="sel-handle"
                style={{ left: x, top: y }}
              />
            ))}
            <span className="spread-frame-rotate-line" />
            <span
              className="spread-frame-handle spread-frame-rotate"
              data-handle="rotate"
              data-testid="rotate-handle"
            />
          </span>
          <span
            className="spread-frame-size-tag"
            data-testid="frame-size-tag"
            aria-hidden
          >
            {sizeLabel(item)}
          </span>
        </>
      ) : null}
    </button>
  )
}
