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
