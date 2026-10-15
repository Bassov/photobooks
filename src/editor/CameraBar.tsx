import { useSyncExternalStore } from 'react'
import { formatZoomPercent } from './camera'
import { getLiveZoom, subscribeLive } from './cameraStore'

export function CameraBar({
  onFitSpread,
  onFitWidth,
  onActualSize,
}: {
  onFitSpread: () => void
  onFitWidth: () => void
  onActualSize: () => void
}) {
  const zoom = useSyncExternalStore(subscribeLive, getLiveZoom, getLiveZoom)

  return (
    <div className="camera-bar">
      <button type="button" className="camera-control" onClick={onFitSpread}>
        Fit spread
      </button>
      <button type="button" className="camera-control" onClick={onFitWidth}>
        Fit width
      </button>
      <button type="button" className="camera-control" onClick={onActualSize}>
        100%
      </button>
      <span className="zoom-indicator" data-testid="zoom-indicator">
        {formatZoomPercent(zoom)}
      </span>
    </div>
  )
}
