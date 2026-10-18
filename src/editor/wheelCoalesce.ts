/** Pending ctrl/meta wheel deltas merged to one apply per animation frame. */
export interface PendingWheel {
  deltaY: number
  clientX: number
  clientY: number
}

/**
 * First event creates the pending record; later events sum `deltaY` and take
 * the latest pointer. Returns the same object when merging.
 */
export function mergePendingWheel(
  pending: PendingWheel | null,
  event: { deltaY: number; clientX: number; clientY: number },
): PendingWheel {
  if (pending === null) {
    return {
      deltaY: event.deltaY,
      clientX: event.clientX,
      clientY: event.clientY,
    }
  }
  pending.deltaY += event.deltaY
  pending.clientX = event.clientX
  pending.clientY = event.clientY
  return pending
}
