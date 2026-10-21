/** Click a mounted input; no-op when the ref has not attached yet. */
export function clickIfPresent(element: HTMLElement | null): void {
  if (element === null) {
    return
  }
  element.click()
}
