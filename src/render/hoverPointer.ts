import { useEffect, useState } from 'react'

const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

/** A hover pointer gets the lightbox side arrows and 64 px side insets. */
export function hoverPointer(): boolean {
  return window.matchMedia(HOVER_QUERY).matches
}

export function useHoverPointer(): boolean {
  const [hover, setHover] = useState(hoverPointer)
  useEffect(() => {
    const query = window.matchMedia(HOVER_QUERY)
    const onChange = () => {
      setHover(query.matches)
    }
    query.addEventListener('change', onChange)
    return () => {
      query.removeEventListener('change', onChange)
    }
  }, [])
  return hover
}
