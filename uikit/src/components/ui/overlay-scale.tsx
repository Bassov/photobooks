/**
 * Interface size, kit side (design interface-size §4): React Aria overlays portal outside the zoomed
 * demo root (to <body> on #/demo, to the scenario stage on #/full), so they carry the session scale
 * themselves, the way prod `src/ui/scaledOverlay.tsx` does:
 * - a positioned overlay stays unzoomed; its single content root is zoomed and carries the box;
 * - offset / crossOffset / containerPadding are app px at 100 %, so they go × s;
 * - a modal overlay root (dialog overlay, toast region) is zoomed as a whole.
 * At 100 % (s = 1) the components render exactly as before: no box, no zoom.
 */
import * as React from "react"
import { composeRenderProps } from "react-aria-components"

import { UiScaleCtx } from "@/demo-parts/session"
import { cn } from "@/lib/utils"

/** The effective kit interface scale as a factor: 1, 1.25 or 1.5. */
export function useOverlayScale(): number {
  return React.useContext(UiScaleCtx) / 100
}

/** React Aria's own default edge padding (usePopover / useTooltip). */
const CONTAINER_PADDING = 12

export function scaledGaps(
  s: number,
  offset: number,
  crossOffset = 0,
  containerPadding = CONTAINER_PADDING
) {
  return {
    offset: offset * s,
    crossOffset: crossOffset * s,
    containerPadding: containerPadding * s,
  }
}

/** Zoom for an overlay root; `--overlay-scale` lets a box divide screen-px vars (--trigger-width) back. */
export const zoomStyle = (s: number) =>
  ({ zoom: s, "--overlay-scale": s }) as React.CSSProperties

/** The positioned element at s ≠ 1: a bare flex column around the zoomed box (React Aria sets its max-height). */
export const POSITIONER = "flex flex-col outline-hidden"

/**
 * At s ≠ 1 the 1 px border would snap to 1 screen px under the zoom, so the box draws the hairline
 * as an inset ring and keeps its 1 px in padding: every size is the 100 % size × s.
 */
export const SCALED_EDGE = "p-px inset-ring inset-ring-border"

type ClassName<T> =
  | string
  | ((values: T & { defaultClassName: string | undefined }) => string)
  | undefined

export const resolveClass = <T,>(className: ClassName<T>, values: T) =>
  typeof className === "function"
    ? className({ ...values, defaultClassName: undefined })
    : className

/** The single zoomed content root of a positioned overlay at s ≠ 1: the box classes, then the consumer's. */
export function scaledBox<T extends object>(
  s: number,
  children: React.ReactNode | ((values: T & { defaultChildren: React.ReactNode }) => React.ReactNode),
  boxClass: string,
  className?: ClassName<T>
) {
  return composeRenderProps(children, (content, values) => (
    <div
      className={cn("min-h-0 overflow-auto", boxClass, resolveClass(className, values))}
      style={zoomStyle(s)}
      data-overlay-box=""
    >
      {content}
    </div>
  ))
}
