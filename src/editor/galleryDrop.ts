import { resolveSpread, type Book } from '../core'
import { measureHandlerSync } from '../perf/measureHandler'
import { getBookStoreSnapshot, dispatchBookOp } from './bookStore'
import { clearDropHover, setDropHover } from './dropHover'
import {
  ASSET_DRAG_MIME,
  buildDropIndex,
  hitTestDrop,
  isAssetDrag,
  type DropIndex,
  type DropSpreadInput,
} from './dropTargets'
import { getSelectedAssetId } from './gallerySelection'

export interface DropGeometry {
  pxPerMm: number
  stridePx: number
  worldWidthPx: number
}

interface DropSession {
  assetId: string
  originX: number
  originY: number
  index: DropIndex
  elements: ReadonlyMap<string, HTMLElement>
}

let session: DropSession | null = null

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

export function activateSelectedFrame(
  spreadId: string,
  frameId: string,
  filled: boolean,
): void {
  const assetId = getSelectedAssetId()
  if (assetId === null) {
    return
  }
  const book = getBookStoreSnapshot().book
  if (!book.gallery.includes(assetId)) {
    return
  }
  dispatchBookOp(
    filled
      ? { type: 'replace', spreadId, frameId, assetId }
      : { type: 'place', spreadId, frameId, assetId },
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

function frameElements(scroll: HTMLElement): Map<string, HTMLElement> {
  const elements = new Map<string, HTMLElement>()
  for (const node of scroll.querySelectorAll<HTMLElement>('[data-frame-id]')) {
    const frameId = node.getAttribute('data-frame-id')
    if (frameId !== null && frameId !== '') {
      elements.set(frameId, node)
    }
  }
  return elements
}

export function installGalleryDrop(
  scroll: HTMLElement,
  readGeometry: () => DropGeometry,
): () => void {
  const world = scroll.querySelector<HTMLElement>(
    '[data-testid="pasteboard-world"]',
  )

  const begin = (event: DragEvent): void => {
    if (!isAssetDrag(event.dataTransfer)) {
      return
    }
    const assetId = assetIdFrom(event)
    if (assetId === null) {
      return
    }
    const geometry = readGeometry()
    const origin = scroll.getBoundingClientRect()
    const book = getBookStoreSnapshot().book
    session = {
      assetId,
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

  const onDragOver = (event: DragEvent): void => {
    if (!isAssetDrag(event.dataTransfer) || session === null) {
      return
    }
    if (world?.dataset.gesture === 'zoom') {
      clearDropHover()
      return
    }
    event.preventDefault()
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy'
    }
    const current = session
    measureHandlerSync('dragover', () => {
      const x = event.clientX - current.originX + scroll.scrollLeft
      const y = event.clientY - current.originY + scroll.scrollTop
      const target = hitTestDrop(current.index, x, y)
      const element =
        target === undefined
          ? null
          : (current.elements.get(target.frameId) ?? null)
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
  }

  const end = (): void => {
    session = null
    clearDropHover()
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
