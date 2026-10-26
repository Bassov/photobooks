// Stryker disable all: look-only inspector stub chrome (crop stays on pasteboard/filmstrip)
import { SUB, T } from './editorChromeTokens'

/** Kit right inspector frame — stub chrome only (crop stays on pasteboard/filmstrip). */
export function InspectorStub() {
  return (
    <div
      className="flex h-full min-h-0 flex-col px-4 py-4"
      data-testid="inspector-stub"
    >
      <h3
        className="mb-3 text-2xs font-semibold tracking-[0.12em] uppercase"
        style={{ color: SUB }}
      >
        Inspector
      </h3>
      <p className="text-sm" style={{ color: T }}>
        Select a frame on the canvas to edit crop and placement. Full inspector
        tools arrive later.
      </p>
    </div>
  )
}
