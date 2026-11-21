import type { ReactNode } from 'react'
import { composeRenderProps } from 'react-aria-components'
import { cx } from './className'
import { useUiScale } from './uiScale'
import './scaledOverlay.css'

/** React Aria's own default edge padding (usePopover / useTooltip). */
const CONTAINER_PADDING = 12

interface OverlayGaps {
  offset: number
  crossOffset?: number | undefined
  containerPadding?: number | undefined
}

/**
 * Interface size (design interface-size §4): overlays portal to `<body>`,
 * outside the zoomed `#root`, so React Aria places them in screen px. The
 * gaps it adds are app px at 100 %; times the effective scale they stay where
 * they would be at 100 %.
 */
export function useScaledGaps({
  offset,
  crossOffset = 0,
  containerPadding = CONTAINER_PADDING,
}: OverlayGaps): {
  offset: number
  crossOffset: number
  containerPadding: number
} {
  const s = useUiScale().effective
  return {
    offset: offset * s,
    crossOffset: crossOffset * s,
    containerPadding: containerPadding * s,
  }
}

/**
 * The single content root of a positioned overlay: it carries the zoom and
 * the box styles (bg, radius, shadow, width), while the element React Aria
 * positions stays unzoomed (see scaledOverlay.css).
 */
export function overlayBox<T>(
  children:
    ReactNode | ((values: T & { defaultChildren: ReactNode }) => ReactNode),
  className: string,
) {
  return composeRenderProps(children, (content) => (
    <div className={cx('pb-overlay-box', className)}>{content}</div>
  ))
}
