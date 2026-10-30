let hovered: HTMLElement | null = null

export function setDropHover(next: HTMLElement | null): void {
  if (hovered === next) {
    return
  }
  if (hovered !== null) {
    hovered.removeAttribute('data-drop-hover')
  }
  if (next !== null) {
    next.setAttribute('data-drop-hover', 'true')
  }
  hovered = next
}

export function clearDropHover(): void {
  setDropHover(null)
}

let dragSource: HTMLElement | null = null

/** Dims the frame whose photo is being dragged (kit FrameEl `isDragging`); cleared at dragend. */
export function setDragSource(next: HTMLElement | null): void {
  if (dragSource !== null) {
    dragSource.removeAttribute('data-drag-source')
  }
  if (next === null) {
    document.removeEventListener('dragend', clearDragSource)
  } else {
    next.setAttribute('data-drag-source', 'true')
    document.addEventListener('dragend', clearDragSource)
  }
  dragSource = next
}

export function clearDragSource(): void {
  setDragSource(null)
}
