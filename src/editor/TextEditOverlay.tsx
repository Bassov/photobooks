import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
  getSpreadTextEditKey,
  registerTextDraft,
  setSpreadOverflow,
  subscribeTextEdit,
} from './textEditStore'
import './TextEditOverlay.css'

/** Chip height + its 4 px gap: below this much paper it goes inside. */
const CHIP_ROOM_PX = 18
/** `scrollHeight` is whole px: a box this close to its content fits. */
const ROUNDING_PX = 1

type TextItem = ResolvedItem & { text: ResolvedText }

function textItems(resolved: ResolvedSpread): TextItem[] {
  return resolved.items.filter(
    (item): item is TextItem => item.text !== undefined && item.parent !== true,
  )
}

function boxStyle(item: ResolvedItem, pxPerMm: number): CSSProperties {
  return {
    left: item.rectMm.x * pxPerMm,
    top: item.rectMm.y * pxPerMm,
    width: item.rectMm.width * pxPerMm,
    height: item.rectMm.height * pxPerMm,
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
    if (el === null) {
      return
    }
    el.value = live.current.item.text.text
    growBox(el, live.current)
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
    return registerTextDraft(() => ({
      text: el.value,
      fitHeightMm: live.current.fitMm,
    }))
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
      style={{
        ...style,
        left: item.rectMm.x * pxPerMm,
        top: item.rectMm.y * pxPerMm,
        width: item.rectMm.width * pxPerMm,
      }}
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

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => b[index] === id)
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
  const [ids, setIds] = useState<readonly string[]>([])
  useEffect(() => {
    let live = true
    const measure = () => {
      const view = ref.current?.closest('[data-testid="spread-view"]')
      if (!live || view === null || view === undefined) {
        return
      }
      const next = measureOverflow(view, textItems(resolved))
      setIds((prev) => (sameIds(prev, next) ? prev : next))
      setSpreadOverflow(spreadId, next)
    }
    loadFonts(textStyleFonts()).then(measure, measure)
    return () => {
      live = false
    }
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
            style={boxStyle(item, pxPerMm)}
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
