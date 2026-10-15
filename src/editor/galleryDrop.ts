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
import { getFrameSource, setFrameSource } from './frameSelection'
import { getSelectedAssetId } from './gallerySelection'

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
  }
}

export function unplaceSelectedFrame(): void {
  const selected = getFrameSource()
  if (selected === null) {
    return
  }
  unplaceFrame(selected)
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
  const transfer = event.dataTransfer
  const decoded = decodeFrameDrag(transfer?.getData(FRAME_DRAG_MIME) ?? '')
  if (decoded !== null) {
    return decoded
  }
  if (!(event.target instanceof Element)) {
    return null
  }
  const node = event.target.closest('[data-frame-id]')
  const frameId = node?.getAttribute('data-frame-id')
  const spreadId = node
    ?.closest('[data-spread-id]')
    ?.getAttribute('data-spread-id')
  if (frameId === null || frameId === undefined || frameId === '') {
    return null
  }
  if (spreadId === null || spreadId === undefined || spreadId === '') {
    return null
  }
  return { spreadId, frameId }
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
      const assetId = assetIdFrom(event)
      if (assetId === null) {
        return
      }
      session = beginSession(scroll, readGeometry, { kind: 'asset', assetId })
      return
    }
    if (!isFrameDrag(event.dataTransfer)) {
      return
    }
    const source = frameSourceFrom(event)
    if (source === null) {
      return
    }
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
      dispatchBookOp(
        target.filled
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
    const action = resolveFrameActivation({
      galleryAssetId: null,
      source: current.source,
      target: {
        spreadId: target.spreadId,
        frameId: target.frameId,
        filled: target.filled,
      },
    })
    if (action.type !== 'swap') {
      return
    }
    dispatchBookOp({
      type: 'swap',
      spreadIdA: action.source.spreadId,
      frameIdA: action.source.frameId,
      spreadIdB: target.spreadId,
      frameIdB: target.frameId,
    })
    setFrameSource(null)
  }

  const end = (): void => {
    session = null
    clearDropHover()
    requestAnimationFrame(() => {
      suppressFrameClick = false
    })
  }

  document.addEventListener('dragstart', begin)
  scroll.addEventListener('dragover', onDragOver)
  scroll.addEventListener('drop', onDrop)
  document.addEventListener('dragend', end)
  return () => {
    document.removeEventListener('dragstart', begin)
    scroll.removeEventListener('dragover', onDragOver)
    scroll.removeEventListener('drop', onDrop)
    document.removeEventListener('dragend', end)
    end()
  }
}

export function installFilmstripUnplace(scroll: HTMLElement): () => void {
  const onDragOver = (event: DragEvent): void => {
    if (!isFrameDrag(event.dataTransfer)) {
      return
    }
    event.preventDefault()
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'move'
    }
    setDropHover(scroll)
  }

  const onDrop = (event: DragEvent): void => {
    if (!isFrameDrag(event.dataTransfer)) {
      return
    }
    event.preventDefault()
    const source = decodeFrameDrag(
      event.dataTransfer?.getData(FRAME_DRAG_MIME) ?? '',
    )
    clearDropHover()
    if (source === null) {
      return
    }
    unplaceFrame(source)
  }

  const end = (): void => {
    clearDropHover()
  }

  scroll.addEventListener('dragover', onDragOver)
  scroll.addEventListener('drop', onDrop)
  document.addEventListener('dragend', end)
  return () => {
    scroll.removeEventListener('dragover', onDragOver)
    scroll.removeEventListener('drop', onDrop)
    document.removeEventListener('dragend', end)
    end()
  }
}
