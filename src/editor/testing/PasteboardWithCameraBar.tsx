import { useSyncExternalStore } from 'react'
import { formatZoomPercent } from '../camera'
import { getCameraCommands, getLiveZoom, subscribeLive } from '../cameraStore'
import { Pasteboard } from '../Pasteboard'

/** Test-only stand-in for the removed camera strip: drives the camera store. */
function CameraTestBar() {
  const zoom = useSyncExternalStore(subscribeLive, getLiveZoom, getLiveZoom)
  return (
    <div role="toolbar" aria-label="Camera test bar">
      <button
        type="button"
        aria-label="Fit spread (Ctrl+0)"
        onClick={() => getCameraCommands()?.fitSpread()}
      />
      <button
        type="button"
        aria-label="Fit width"
        onClick={() => getCameraCommands()?.fitWidth()}
      />
      <button
        type="button"
        aria-label="100%"
        onClick={() => getCameraCommands()?.actualSize()}
      />
      <span data-testid="zoom-indicator">{formatZoomPercent(zoom)}</span>
    </div>
  )
}

export function PasteboardWithCameraBar() {
  return (
    <>
      <CameraTestBar />
      <Pasteboard />
    </>
  )
}
