import { useState } from 'react'

export interface ClientSize {
  width: number
  height: number
}

/**
 * Client size of the element the returned ref callback is attached to,
 * re-measured on every resize; `null` until attached. The callback is created
 * once, so React never detaches and re-attaches it between renders.
 */
export function useClientSize(): [
  ClientSize | null,
  (node: HTMLDivElement) => () => void,
] {
  const [size, setSize] = useState<ClientSize | null>(null)
  const [attach] = useState(() => (node: HTMLDivElement) => {
    const measure = (): void => {
      setSize({ width: node.clientWidth, height: node.clientHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  })
  return [size, attach]
}
