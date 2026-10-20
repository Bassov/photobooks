import { memo, useSyncExternalStore } from 'react'
import { Icon } from '../ui/Icon'
import '../ui/Button.css'
import '../ui/IconButton.css'
import { formatZoomPercent } from './camera'
import { getLiveZoom, subscribeLive } from './cameraStore'

export const CameraBar = memo(function CameraBar({
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
    <div role="toolbar" aria-label="Camera" className="camera-bar">
      <button
        type="button"
        className="pb-button pb-button--ghost pb-button--sm pb-icon-button pb-icon-button--sm"
        aria-label="Fit spread (Ctrl+0)"
        title="Fit spread (Ctrl+0)"
        onClick={onFitSpread}
      >
        <Icon name="fit" size={16} />
      </button>
      <button
        type="button"
        className="pb-button pb-button--secondary pb-button--sm"
        title="Fit width"
        onClick={onFitWidth}
      >
        Fit width
      </button>
      <button
        type="button"
        className="pb-button pb-button--secondary pb-button--sm"
        title="100%"
        onClick={onActualSize}
      >
        100%
      </button>
      <span className="zoom-indicator" data-testid="zoom-indicator">
        {formatZoomPercent(zoom)}
      </span>
    </div>
  )
})
