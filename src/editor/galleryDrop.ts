import { resolveSpread, type Book } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import {
  dispatchBookOp,
  getAssetDisplayName,
  getBookStoreSnapshot,
} from './bookStore'
import { requestGalleryRemove } from './galleryRemoveRequest'
import { clearDropHover, setDropHover } from './dropHover'
import {
  ASSET_DRAG_MIME,
  ASSET_MULTI_MIME,
  FRAME_DRAG_MIME,
  buildDropIndex,
  decodeAssetIds,
  decodeFrameDrag,
  hitTestDrop,
  hitTestGap,
  isAssetDrag,
  isFrameDrag,
  resolveFrameActivation,
  type DropIndex,
  type DropSpreadInput,
  type FrameDragSource,
} from './dropTargets'
import { dropAssets } from './multiDrop'
import {
  STATUS_MOVED,
  STATUS_SELECTED,
  STATUS_SWAPPED,
  STATUS_UNPLACED,
  setEditorStatus,
} from './editorStatus'
import { getFrameSource, setFrameSource } from './frameSelection'
import { setSelectedAssetId } from './gallerySelection'

function clearDropSession(): void {
  session = null
  localFrameDrag = null
  frameDragSeen = false
}

function frameFilledInBook(
  book: Book,
  spreadId: string,
  frameId: string,
): boolean {
  return book.spreads.some(
    (spread) =>
      spread.id === spreadId &&
      spread.frames.some(
        (frame) => frame.id === frameId && frame.assetId !== undefined,
      ),
  )
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
  /** "New spread" zone elements keyed by insert index. */
  gapElements: ReadonlyMap<number, HTMLElement>
}

type DropSession = DropSessionBase &
  (
    | { kind: 'asset'; assetId: string; assetIds: readonly string[] }
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
  const source = getFrameSource()
  const action = resolveFrameActivation({
    source,
    sourceFilled:
      source === null ||
      frameFilledInBook(
        getBookStoreSnapshot().book,
        source.spreadId,
        source.frameId,
      ),
    target: { spreadId, frameId, filled },
  })
  if (action.type === 'select-source') {
    setFrameSource({ spreadId, frameId })
    // An empty frame has no photo to announce as selected.
    setEditorStatus(filled ? STATUS_SELECTED : '')
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

/** Delete on a selected empty frame removes it (the spread leaves its template). */
function removeSelectedEmptyFrame(): boolean {
  const selected = getFrameSource()
  if (
    selected === null ||
    frameFilledInBook(
      getBookStoreSnapshot().book,
      selected.spreadId,
      selected.frameId,
    )
  ) {
    return false
  }
  const exists = getBookStoreSnapshot().book.spreads.some(
    (spread) =>
      spread.id === selected.spreadId &&
      spread.frames.some((frame) => frame.id === selected.frameId),
  )
  if (!exists) {
    return false
  }
  setFrameSource(null)
  dispatchBookOp({
    type: 'removeFrames',
    spreadId: selected.spreadId,
    frameIds: [selected.frameId],
  })
  setEditorStatus('')
  return true
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

function gapElements(scroll: HTMLElement): Map<number, HTMLElement> {
  const elements = new Map<number, HTMLElement>()
  for (const node of scroll.querySelectorAll<HTMLElement>(
    '[data-gap-insert-index]',
  )) {
    elements.set(Number(node.getAttribute('data-gap-insert-index')), node)
  }
  return elements
}

function beginSession(
  scroll: HTMLElement,
  readGeometry: () => DropGeometry,
  drag:
    | { kind: 'asset'; assetId: string; assetIds: readonly string[] }
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
      spreadHeightPx: book.settings.trim.heightMm * geometry.pxPerMm,
    }),
    elements: frameElements(scroll),
    gapElements: gapElements(scroll),
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
      // Stryker disable next-line OptionalChaining: isAssetDrag above proves a DataTransfer
      const carried = event.dataTransfer?.getData(ASSET_MULTI_MIME) ?? ''
      const multi = decodeAssetIds(carried)
      session = beginSession(scroll, readGeometry, {
        kind: 'asset',
        assetId,
        assetIds: multi.includes(assetId) ? multi : [assetId],
      })
      scroll.dataset.assetDrag = 'true'
      return
    }
    if (!isFrameDrag(event.dataTransfer)) {
      // Unrelated drag must not leave a prior asset/frame session armed for drop.
      clearDropSession()
      return
    }
    // Always drop leftover filmstrip selection on a frame MIME dragstart,
    // including when getData is empty (opaque PLC-04 path).
    setSelectedAssetId(null)
    const source = frameSourceFrom(event)
    if (source === null) {
      session = null
      localFrameDrag = null
      return
    }
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
      if (target !== undefined) {
        setDropHover(
          current.elements.get(`${target.spreadId}\n${target.frameId}`) ?? null,
        )
        return
      }
      const gap =
        current.kind === 'asset' ? hitTestGap(current.index, y) : undefined
      setDropHover(
        gap === undefined ? null : (current.gapElements.get(gap) ?? null),
      )
    })
  }

  const onDrop = (event: DragEvent): void => {
    releaseFrameDragClickSoon()
    delete scroll.dataset.assetDrag
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
      const insertIndex =
        current.kind === 'asset' ? hitTestGap(current.index, y) : undefined
      if (current.kind === 'asset' && insertIndex !== undefined) {
        dropAssets({ type: 'gap', insertIndex }, current.assetIds)
      }
      return
    }
    if (current.kind === 'asset') {
      dropAssets(
        { type: 'frame', spreadId: target.spreadId, frameId: target.frameId },
        current.assetIds,
      )
      return
    }
    const book = getBookStoreSnapshot().book
    const filled = frameFilledInBook(book, target.spreadId, target.frameId)
    const action = resolveFrameActivation({
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
    delete scroll.dataset.assetDrag
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
    const thumbId =
      event.target.closest('.filmstrip-item')?.getAttribute('data-asset-id') ??
      ''
    if (thumbId !== '') {
      event.preventDefault()
      requestGalleryRemove(thumbId, getAssetDisplayName(thumbId))
      return
    }
    const button = event.target.closest('button.spread-frame')
    if (
      !(button instanceof HTMLElement) ||
      button.getAttribute('data-filled') !== 'true'
    ) {
      // A filled focused frame unplaces below; otherwise Delete removes the
      // selected empty frame.
      if (removeSelectedEmptyFrame()) {
        event.preventDefault()
      }
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
