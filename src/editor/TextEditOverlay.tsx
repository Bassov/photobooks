import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import type { ResolvedItem, ResolvedSpread, ResolvedText } from '../core'
import { loadFonts } from '../fonts/loadBookFonts'
import {
  fitTextHeightMm,
  textLineMm,
  textNodeStyle,
  textStyleFonts,
  wholeLinesHeightMm,
} from '../render/textStyles'
import { FrameGlyph } from '../render/SpreadView'
import { ICON_GLYPHS } from '../ui/icons/glyphs'
import {
  cancelTextEdit,
  commitTextEdit,
  getSpreadOverflow,
  getSpreadTextEditKey,
  getTextEditSource,
  registerTextDraft,
  setSpreadOverflow,
  subscribeTextEdit,
  subscribeTextOverflow,
} from './textEditStore'
import './TextEditOverlay.css'

/** Chip height + its 4 px gap: below this much paper it goes inside. */
const CHIP_ROOM_PX = 18
/** `scrollHeight` is whole px: a box this close to its content fits. */
const ROUNDING_PX = 1

type TextItem = ResolvedItem & { text: ResolvedText }

let fontsReady: Promise<void> | null = null

/** Faces never unload: one load serves every later measure (drag frames too). */
function textFontsReady(): Promise<void> {
  fontsReady ??= loadFonts(textStyleFonts())
  return fontsReady
}

function textItems(resolved: ResolvedSpread): TextItem[] {
  return resolved.items.filter(
    (item): item is TextItem => item.text !== undefined && item.parent !== true,
  )
}

/** The frame's left / top / width on the painted spread. */
function placeStyle(item: ResolvedItem, pxPerMm: number): CSSProperties {
  return {
    left: item.rectMm.x * pxPerMm,
    top: item.rectMm.y * pxPerMm,
    width: item.rectMm.width * pxPerMm,
  }
}

/**
 * Editor layer of a spread's text frames (Designer text-frames): the edit
 * textarea over the edited frame and the Overflow chips. Typing re-renders
 * nothing: the textarea is uncontrolled and commits on exit.
 */
export function TextEditOverlay({
  spreadId,
  resolved,
  pxPerMm,
}: {
  spreadId: string
  resolved: ResolvedSpread
  pxPerMm: number
}) {
  const editingId = useSyncExternalStore(
    subscribeTextEdit,
    () => getSpreadTextEditKey(spreadId),
    () => getSpreadTextEditKey(spreadId),
  )
  const texts = textItems(resolved)
  const edited = texts.find((item) => item.frameId === editingId)
  const gone = editingId !== '' && edited === undefined
  useEffect(() => {
    // Undo or a delete took the frame away mid-edit.
    if (gone) {
      cancelTextEdit()
    }
  }, [gone])
  return (
    <>
      {edited === undefined ? null : (
        <TextEditBox
          key={edited.frameId}
          item={edited}
          pxPerMm={pxPerMm}
          paperHeightMm={resolved.spreadHeightMm}
        />
      )}
      <OverflowChips
        spreadId={spreadId}
        resolved={resolved}
        pxPerMm={pxPerMm}
        editingId={editingId}
      />
    </>
  )
}

interface EditBoxState {
  item: TextItem
  pxPerMm: number
  paperHeightMm: number
  /** Whole-line height the text needs, for the commit. */
  fitMm: number
}

/**
 * Grow to the whole lines the text needs (never below the frame, never past
 * the paper); the book takes the height on commit.
 */
function growBox(el: HTMLTextAreaElement, state: EditBoxState): void {
  const { item, pxPerMm, paperHeightMm } = state
  const { styleId } = item.text
  el.style.height = `${String(wholeLinesHeightMm(item.rectMm.height, styleId) * pxPerMm)}px`
  const contentMm = Math.max(el.scrollHeight - ROUNDING_PX, 0) / pxPerMm
  state.fitMm = Math.max(
    Math.min(
      fitTextHeightMm(contentMm, styleId),
      paperHeightMm - item.rectMm.y,
    ),
    textLineMm(styleId),
  )
  const shown = Math.max(item.rectMm.height, state.fitMm)
  el.style.height = `${String(wholeLinesHeightMm(shown, styleId) * pxPerMm)}px`
}

function TextEditBox({
  item,
  pxPerMm,
  paperHeightMm,
}: {
  item: TextItem
  pxPerMm: number
  paperHeightMm: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const live = useRef<EditBoxState>({ item, pxPerMm, paperHeightMm, fitMm: 0 })

  // Latest props for the handlers; a zoom or restyle re-fits the box.
  useLayoutEffect(() => {
    live.current = { ...live.current, item, pxPerMm, paperHeightMm }
    if (ref.current !== null) {
      growBox(ref.current, live.current)
    }
  })

  // Mount only: the textarea is uncontrolled while it is edited.
  useLayoutEffect(() => {
    const el = ref.current
    if (el !== null) {
      // A live caption edits its template; the canvas paints it resolved.
      el.value = getTextEditSource() ?? live.current.item.text.text
      growBox(el, live.current)
      // Setting the value already put the caret at the end.
      el.focus({ preventScroll: true })
      return registerTextDraft(() => ({
        text: el.value,
        fitHeightMm: live.current.fitMm,
      }))
    }
  }, [])

  const style = textNodeStyle(item.text, item.rectMm.height, pxPerMm)
  return (
    <textarea
      ref={ref}
      className="text-edit-box"
      data-testid="text-edit"
      aria-label="Text"
      placeholder="Type text"
      spellCheck={false}
      style={{ ...style, ...placeStyle(item, pxPerMm) }}
      onInput={(event) => {
        growBox(event.currentTarget, live.current)
      }}
      onKeyDown={(event) => {
        // Editor shortcuts never see typing; Esc must not deselect here.
        event.stopPropagation()
        if (
          event.key === 'Escape' ||
          (event.key === 'Enter' && (event.ctrlKey || event.metaKey))
        ) {
          event.preventDefault()
          commitTextEdit()
        }
      }}
      onBlur={() => {
        // Leaving the window keeps the edit; a click elsewhere commits it.
        if (document.hasFocus()) {
          commitTextEdit()
        }
      }}
    />
  )
}

/** Painted text nodes taller than their whole-line box (fonts loaded first). */
function measureOverflow(view: Element, texts: readonly TextItem[]): string[] {
  return texts
    .filter((item) => {
      if (item.text.text === '') {
        return false
      }
      const node = view.querySelector(
        `[data-frame-id="${CSS.escape(item.frameId)}"] .spread-frame-text`,
      )
      return (
        node instanceof HTMLElement &&
        node.scrollHeight > node.clientHeight + ROUNDING_PX
      )
    })
    .map((item) => item.frameId)
}

function OverflowChips({
  spreadId,
  resolved,
  pxPerMm,
  editingId,
}: {
  spreadId: string
  resolved: ResolvedSpread
  pxPerMm: number
  editingId: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const ids = useSyncExternalStore(
    subscribeTextOverflow,
    () => getSpreadOverflow(spreadId),
    () => getSpreadOverflow(spreadId),
  )
  useEffect(() => {
    // Any measure reads the DOM as it is now, so a stale one is harmless.
    const measure = () => {
      const view = ref.current?.closest('[data-testid="spread-view"]') ?? null
      if (view !== null) {
        setSpreadOverflow(spreadId, measureOverflow(view, textItems(resolved)))
      }
    }
    textFontsReady().then(measure, measure)
  }, [spreadId, resolved, pxPerMm])
  useEffect(
    () => () => {
      setSpreadOverflow(spreadId, [])
    },
    [spreadId],
  )
  const shown = textItems(resolved).filter(
    (item) => ids.includes(item.frameId) && item.frameId !== editingId,
  )
  return (
    <span ref={ref} className="text-overflow-layer" aria-hidden>
      {shown.map((item) => {
        const room =
          (resolved.spreadHeightMm - item.rectMm.y - item.rectMm.height) *
          pxPerMm
        return (
          <span
            key={item.frameId}
            className="text-overflow-anchor"
            style={{
              ...placeStyle(item, pxPerMm),
              height: item.rectMm.height * pxPerMm,
            }}
          >
            <span
              className="text-overflow-chip"
              data-testid="text-overflow-chip"
              data-inside={room < CHIP_ROOM_PX ? 'true' : undefined}
              data-camera-frame=""
              title="Text doesn't fit the frame"
            >
              <FrameGlyph
                nodes={ICON_GLYPHS.warning}
                size={10}
                name="warning"
              />
              Overflow
            </span>
          </span>
        )
      })}
    </span>
  )
}
