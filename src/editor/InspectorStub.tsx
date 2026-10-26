/** Kit right inspector frame — stub chrome only (crop stays on pasteboard/filmstrip). */
export function InspectorStub() {
  return (
    <div
      className="editor-inspector-stub flex h-full min-h-0 flex-col px-4 py-4"
      data-testid="inspector-stub"
    >
      <h3 className="editor-inspector-stub__title mb-3 text-2xs font-semibold tracking-[0.12em] uppercase">
        Inspector
      </h3>
      <p className="editor-inspector-stub__body text-sm">
        Select a frame on the canvas to edit crop and placement. Full inspector
        tools arrive later.
      </p>
    </div>
  )
}
