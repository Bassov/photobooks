type Listener = () => void

export interface CommittedCamera {
  zoom: number
  scrollLeft: number
  scrollTop: number
  epoch: number
}

const INITIAL_CAMERA: CommittedCamera = {
  zoom: 1,
  scrollLeft: 0,
  scrollTop: 0,
  epoch: 0,
}

let committed: CommittedCamera = INITIAL_CAMERA
let liveZoom = 1

const committedListeners = new Set<Listener>()
const liveListeners = new Set<Listener>()

export function getCommittedCamera(): CommittedCamera {
  return committed
}

export function getCommittedZoom(): number {
  return committed.zoom
}

export function getLiveZoom(): number {
  return liveZoom
}

export function subscribeCommitted(listener: Listener): () => void {
  committedListeners.add(listener)
  return () => {
    committedListeners.delete(listener)
  }
}

export function subscribeLive(listener: Listener): () => void {
  liveListeners.add(listener)
  return () => {
    liveListeners.delete(listener)
  }
}

export function setLiveZoom(zoom: number): void {
  if (!Number.isFinite(zoom) || zoom === liveZoom) {
    return
  }
  liveZoom = zoom
  emit(liveListeners)
}

export function commitZoom(
  zoom: number,
  scrollLeft: number,
  scrollTop: number,
): void {
  if (!Number.isFinite(zoom)) {
    return
  }
  const left = Number.isFinite(scrollLeft) ? scrollLeft : 0
  const top = Number.isFinite(scrollTop) ? scrollTop : 0
  const liveChanged = zoom !== liveZoom
  const committedChanged =
    zoom !== committed.zoom ||
    left !== committed.scrollLeft ||
    top !== committed.scrollTop
  liveZoom = zoom
  if (committedChanged) {
    committed = {
      zoom,
      scrollLeft: left,
      scrollTop: top,
      epoch: committed.epoch + 1,
    }
  }
  if (liveChanged) {
    emit(liveListeners)
  }
  if (committedChanged) {
    emit(committedListeners)
  }
}

export function resetCameraStore(): void {
  const liveChanged = liveZoom !== 1
  const committedChanged = committed !== INITIAL_CAMERA
  liveZoom = 1
  committed = INITIAL_CAMERA
  if (liveChanged) {
    emit(liveListeners)
  }
  if (committedChanged) {
    emit(committedListeners)
  }
}

function emit(listeners: Set<Listener>): void {
  for (const listener of listeners) {
    listener()
  }
}
