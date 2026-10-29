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

/** Pasteboard-side camera actions the top bar can invoke (viewport lives there). */
export interface CameraCommands {
  fitSpread: () => void
  fitWidth: () => void
  actualSize: () => void
  /** Place (clamped, centred) an absolute zoom. */
  zoomTo: (zoom: number) => void
  /** Zoom at which the spread fits the pasteboard, `null` without a viewport. */
  fitSpreadZoom: () => number | null
}

let commands: CameraCommands | null = null

export function registerCameraCommands(next: CameraCommands): () => void {
  commands = next
  return () => {
    if (commands === next) {
      commands = null
    }
  }
}

export function getCameraCommands(): CameraCommands | null {
  return commands
}

function emit(listeners: Set<Listener>): void {
  for (const listener of listeners) {
    listener()
  }
}
