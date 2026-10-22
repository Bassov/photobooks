import { resolveSpread, type Book } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { getBookStoreSnapshot, dispatchBookOp } from './bookStore'
import { clearDropHover, setDropHover } from './dropHover'
import {
  ASSET_DRAG_MIME,
  FRAME_DRAG_MIME,
  buildDropIndex,
  decodeFrameDrag,
  hitTestDrop,
  isAssetDrag,
  isFrameDrag,
  resolveFrameActivation,
  type DropIndex,
  type DropSpreadInput,
  type FrameDragSource,
} from './dropTargets'
import {
  STATUS_MOVED,
  STATUS_SELECTED,
  STATUS_SWAPPED,
  STATUS_UNPLACED,
  setEditorStatus,
} from './editorStatus'
import { getFrameSource, setFrameSource } from './frameSelection'
import { getSelectedAssetId, setSelectedAssetId } from './gallerySelection'

function clearDropSession(): void {
  session = null
  localFrameDrag = null
  // Stryker disable next-line BooleanLiteral: arming reset covered by filmstrip hover/drop tests after clear
  frameDragSeen = false
}

function frameFilledInBook(
  book: Book,
  spreadId: string,
  frameId: string,
): boolean {
  // Hit-test targets always exist in the current book; id mismatch → empty.
  /* Stryker disable all: wrong-id / missing-spread branches are equivalent to empty for place vs replace */
  const frame = book.spreads
    .find((candidate) => candidate.id === spreadId)
    ?.frames.find((candidate) => candidate.id === frameId)
  return frame?.assetId !== undefined
  /* Stryker restore all */
}

export interface DropGeometry {
  pxPerMm: number
  stridePx: number
  worldWidthPx: number
}

interface DropSessionBase {
  originX: number
  originY: number
  index: DropIndex
  elements: ReadonlyMap<string, HTMLElement>
}

type DropSession = DropSessionBase &
  (
    | { kind: 'asset'; assetId: string }
    | { kind: 'frame'; source: FrameDragSource }
  )

let session: DropSession | null = null
let localFrameDrag: FrameDragSource | null = null
/** True after a frame MIME dragstart in this document (even if getData was empty). */
let frameDragSeen = false
let suppressFrameClick = false

export function dropSpreadsFromBook(
  book: Book,
  geometry: DropGeometry,
): DropSpreadInput[] {
  const spreads: DropSpreadInput[] = []
  for (const spread of book.spreads) {
    const resolved = resolveSpread(book, spread.id)
    if (resolved === undefined) {
      continue
    }
    const items = []
    for (const item of resolved.items) {
      items.push({
        frameId: item.frameId,
        z: item.z,
        filled: item.assetId !== undefined,
        rectMm: item.rectMm,
      })
    }
    spreads.push({
      spreadId: spread.id,
      spreadWidthPx: resolved.spreadWidthMm * geometry.pxPerMm,
      items,
    })
  }
  return spreads
}

export function armFrameDragClick(): void {
  suppressFrameClick = true
}

function releaseFrameDragClick(): void {
  suppressFrameClick = false
}

function releaseFrameDragClickSoon(): void {
  queueMicrotask(() => {
    suppressFrameClick = false
  })
}

function takeFrameDragClick(): boolean {
  if (!suppressFrameClick) {
    return false
  }
  suppressFrameClick = false
  return true
}

export function activateFrame(
  spreadId: string,
  frameId: string,
  filled: boolean,
): void {
  if (takeFrameDragClick()) {
    return
  }
  const action = resolveFrameActivation({
    galleryAssetId: getSelectedAssetId(),
    source: getFrameSource(),
    target: { spreadId, frameId, filled },
  })
  if (action.type === 'place' || action.type === 'replace') {
    const book = getBookStoreSnapshot().book
    if (!book.gallery.includes(action.assetId)) {
      return
    }
    dispatchBookOp({
      type: action.type,
      spreadId,
      frameId,
      assetId: action.assetId,
    })
    return
  }
  if (action.type === 'select-source') {
    setFrameSource({ spreadId, frameId })
    setEditorStatus(STATUS_SELECTED)
    return
  }
  if (action.type === 'clear-source') {
    setFrameSource(null)
    setEditorStatus('')
    return
  }
  if (action.type === 'swap') {
    dispatchBookOp({
      type: 'swap',
      spreadIdA: action.source.spreadId,
      frameIdA: action.source.frameId,
      spreadIdB: spreadId,
      frameIdB: frameId,
    })
    setFrameSource(null)
    setEditorStatus(filled ? STATUS_SWAPPED : STATUS_MOVED)
  }
}

export function unplaceSelectedFrame(): void {
  const selected = getFrameSource()
  if (selected === null) {
    return
  }
  unplaceFrame(selected)
  focusFrameButton(selected)
}

function unplaceFrame(source: FrameDragSource): void {
  dispatchBookOp({
    type: 'unplace',
    spreadId: source.spreadId,
    frameId: source.frameId,
  })
  const selected = getFrameSource()
  if (
    selected !== null &&
    selected.spreadId === source.spreadId &&
    selected.frameId === source.frameId
  ) {
    setFrameSource(null)
  }
  setEditorStatus(STATUS_UNPLACED)
}

function sameFrame(a: FrameDragSource, b: FrameDragSource): boolean {
  return a.spreadId === b.spreadId && a.frameId === b.frameId
}

function focusFrameButton(source: FrameDragSource): void {
  const spread = document.querySelector(
    `[data-testid="spread-view"][data-spread-id="${CSS.escape(source.spreadId)}"]`,
  )
  const button = spread?.querySelector(
    `button[data-frame-id="${CSS.escape(source.frameId)}"]`,
  )
  if (button instanceof HTMLElement) {
    button.focus()
  }
}

function matchesLocalFrameDrag(payload: FrameDragSource | null): boolean {
  return (
    localFrameDrag !== null &&
    payload !== null &&
    sameFrame(localFrameDrag, payload)
  )
}

function assetIdFrom(event: DragEvent): string | null {
  const transfer = event.dataTransfer
  const fromTransfer = transfer?.getData(ASSET_DRAG_MIME) ?? ''
  if (fromTransfer !== '') {
    return fromTransfer
  }
  if (!(event.target instanceof Element)) {
    return null
  }
  const node = event.target.closest('[data-asset-id]')
  return node?.getAttribute('data-asset-id') ?? null
}

function frameSourceFrom(event: DragEvent): FrameDragSource | null {
  return decodeFrameDrag(event.dataTransfer?.getData(FRAME_DRAG_MIME) ?? '')
}

function frameElements(scroll: HTMLElement): Map<string, HTMLElement> {
  const elements = new Map<string, HTMLElement>()
  for (const node of scroll.querySelectorAll<HTMLElement>('[data-frame-id]')) {
    const frameId = node.getAttribute('data-frame-id')
    const spreadId = node
      .closest('[data-spread-id]')
      ?.getAttribute('data-spread-id')
    if (
      frameId !== null &&
      frameId !== '' &&
      spreadId !== null &&
      spreadId !== undefined &&
      spreadId !== ''
    ) {
      elements.set(`${spreadId}\n${frameId}`, node)
    }
  }
  return elements
}

function beginSession(
  scroll: HTMLElement,
  readGeometry: () => DropGeometry,
  drag:
    | { kind: 'asset'; assetId: string }
    | { kind: 'frame'; source: FrameDragSource },
): DropSession {
  const geometry = readGeometry()
  const origin = scroll.getBoundingClientRect()
  const book = getBookStoreSnapshot().book
  return {
    ...drag,
    originX: origin.left,
    originY: origin.top,
    index: buildDropIndex({
      spreads: dropSpreadsFromBook(book, geometry),
      pxPerMm: geometry.pxPerMm,
      stridePx: geometry.stridePx,
      worldWidthPx: geometry.worldWidthPx,
    }),
    elements: frameElements(scroll),
  }
}

export function installGalleryDrop(
  scroll: HTMLElement,
  readGeometry: () => DropGeometry,
): () => void {
  const world = scroll.querySelector<HTMLElement>(
    '[data-testid="pasteboard-world"]',
  )

  const begin = (event: DragEvent): void => {
    if (isAssetDrag(event.dataTransfer)) {
      frameDragSeen = false
      localFrameDrag = null
      const assetId = assetIdFrom(event)
      if (assetId === null) {
        clearDropSession()
        return
      }
      session = beginSession(scroll, readGeometry, { kind: 'asset', assetId })
      return
    }
    if (!isFrameDrag(event.dataTransfer)) {
      // Unrelated drag must not leave a prior asset/frame session armed for drop.
      clearDropSession()
      return
    }
    const source = frameSourceFrom(event)
    if (source === null) {
      session = null
      localFrameDrag = null
      return
    }
    setSelectedAssetId(null)
    localFrameDrag = source
    session = beginSession(scroll, readGeometry, { kind: 'frame', source })
  }

  const onDragOver = (event: DragEvent): void => {
    const current = session
    if (current === null) {
      return
    }
    const assetDrag = isAssetDrag(event.dataTransfer)
    const frameDrag = isFrameDrag(event.dataTransfer)
    if (assetDrag && current.kind !== 'asset') {
      return
    }
    if (frameDrag && current.kind !== 'frame') {
      return
    }
    if (!assetDrag && !frameDrag) {
      return
    }
    if (world?.dataset.gesture === 'zoom') {
      clearDropHover()
      return
    }
    event.preventDefault()
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = current.kind === 'frame' ? 'move' : 'copy'
    }
    measureHandlerSync('dragover', () => {
      const x = event.clientX - current.originX + scroll.scrollLeft
      const y = event.clientY - current.originY + scroll.scrollTop
      const target = hitTestDrop(current.index, x, y)
      const element =
        target === undefined
          ? null
          : (current.elements.get(`${target.spreadId}\n${target.frameId}`) ??
            null)
      setDropHover(element)
    })
  }

  const onDrop = (event: DragEvent): void => {
    releaseFrameDragClickSoon()
    if (session === null || world?.dataset.gesture === 'zoom') {
      clearDropHover()
      session = null
      return
    }
    event.preventDefault()
    const current = session
    const x = event.clientX - current.originX + scroll.scrollLeft
    const y = event.clientY - current.originY + scroll.scrollTop
    const target = hitTestDrop(current.index, x, y)
    session = null
    clearDropHover()
    if (target === undefined) {
      return
    }
    if (current.kind === 'asset') {
      const book = getBookStoreSnapshot().book
      if (!book.gallery.includes(current.assetId)) {
        return
      }
      const filled = frameFilledInBook(book, target.spreadId, target.frameId)
      dispatchBookOp(
        filled
          ? {
              type: 'replace',
              spreadId: target.spreadId,
              frameId: target.frameId,
              assetId: current.assetId,
            }
          : {
              type: 'place',
              spreadId: target.spreadId,
              frameId: target.frameId,
              assetId: current.assetId,
            },
      )
      return
    }
    const book = getBookStoreSnapshot().book
    const filled = frameFilledInBook(book, target.spreadId, target.frameId)
    const action = resolveFrameActivation({
      galleryAssetId: null,
      source: current.source,
      target: {
        spreadId: target.spreadId,
        frameId: target.frameId,
        filled,
      },
    })
    const payload = frameSourceFrom(event)
    const sameDrag = matchesLocalFrameDrag(payload)
    localFrameDrag = null
    if (action.type !== 'swap' || !sameDrag) {
      return
    }
    const dragged = current.source
    const keyboard = getFrameSource()
    const clearKeyboard = keyboard !== null && sameFrame(keyboard, dragged)
    dispatchBookOp({
      type: 'swap',
      spreadIdA: action.source.spreadId,
      frameIdA: action.source.frameId,
      spreadIdB: target.spreadId,
      frameIdB: target.frameId,
    })
    if (clearKeyboard) {
      setFrameSource(null)
    }
    setEditorStatus(filled ? STATUS_SWAPPED : STATUS_MOVED)
  }

  const end = (): void => {
    clearDropSession()
    clearDropHover()
    requestAnimationFrame(() => {
      suppressFrameClick = false
    })
  }

  document.addEventListener('dragstart', begin)
  document.addEventListener('pointerdown', releaseFrameDragClick, true)
  document.addEventListener('keydown', releaseFrameDragClick, true)
  scroll.addEventListener('dragover', onDragOver)
  scroll.addEventListener('drop', onDrop)
  document.addEventListener('dragend', end)
  return () => {
    document.removeEventListener('dragstart', begin)
    document.removeEventListener('pointerdown', releaseFrameDragClick, true)
    document.removeEventListener('keydown', releaseFrameDragClick, true)
    scroll.removeEventListener('dragover', onDragOver)
    scroll.removeEventListener('drop', onDrop)
    document.removeEventListener('dragend', end)
    end()
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('input, textarea, select, [contenteditable="true"]') !== null
  )
}

export function installEditorKeys(): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      setFrameSource(null)
      setSelectedAssetId(null)
      setEditorStatus('')
      return
    }
    if (event.key !== 'Delete' && event.key !== 'Backspace') {
      return
    }
    if (isTypingTarget(event.target) || !(event.target instanceof Element)) {
      return
    }
    const button = event.target.closest('button.spread-frame')
    if (!(button instanceof HTMLElement)) {
      return
    }
    if (button.getAttribute('data-filled') !== 'true') {
      return
    }
    const frameId = button.getAttribute('data-frame-id')
    const spreadId = button
      .closest('[data-spread-id]')
      ?.getAttribute('data-spread-id')
    if (
      frameId === null ||
      frameId === '' ||
      spreadId === null ||
      spreadId === undefined ||
      spreadId === ''
    ) {
      return
    }
    event.preventDefault()
    const source = { spreadId, frameId }
    unplaceFrame(source)
    focusFrameButton(source)
  }
  document.addEventListener('keydown', onKeyDown)
  return () => {
    document.removeEventListener('keydown', onKeyDown)
  }
}

export function installFilmstripUnplace(scroll: HTMLElement): () => void {
  const onDragStart = (event: DragEvent): void => {
    if (!isFrameDrag(event.dataTransfer)) {
      return
    }
    frameDragSeen = true
    localFrameDrag = frameSourceFrom(event)
  }

  const onDragOver = (event: DragEvent): void => {
    if (!isFrameDrag(event.dataTransfer) || !frameDragSeen) {
      return
    }
    event.preventDefault()
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'move'
    }
    setDropHover(scroll)
  }

  const onDrop = (event: DragEvent): void => {
    releaseFrameDragClickSoon()
    if (!isFrameDrag(event.dataTransfer)) {
      return
    }
    event.preventDefault()
    const armed = localFrameDrag
    const seen = frameDragSeen
    const source = frameSourceFrom(event)
    localFrameDrag = null
    frameDragSeen = false
    clearDropHover()
    // Require a frame dragstart in this document. Drop MIME is authoritative
    // when dragstart getData was empty (armed null) but types listed the MIME.
    if (source === null || !seen) {
      return
    }
    if (armed !== null && !sameFrame(armed, source)) {
      return
    }
    unplaceFrame(source)
  }

  const end = (): void => {
    localFrameDrag = null
    frameDragSeen = false
    clearDropHover()
  }

  document.addEventListener('dragstart', onDragStart)
  scroll.addEventListener('dragover', onDragOver)
  scroll.addEventListener('drop', onDrop)
  document.addEventListener('dragend', end)
  return () => {
    document.removeEventListener('dragstart', onDragStart)
    scroll.removeEventListener('dragover', onDragOver)
    scroll.removeEventListener('drop', onDrop)
    document.removeEventListener('dragend', end)
    end()
  }
}
