import { Panel } from '../ui/Panel'

/** Kit right inspector frame — stub chrome only (crop stays on pasteboard/filmstrip). */
export function InspectorStub({ onCollapse }: { onCollapse?: () => void }) {
  return (
    <Panel
      side="right"
      title="Inspector"
      shortcut="]"
      {...(onCollapse ? { onCollapse } : {})}
      className="editor-inspector-stub"
      data-testid="inspector-stub"
    >
      <p className="editor-inspector-stub__body px-4 text-sm">
        Select a frame on the canvas to edit crop and placement. Full inspector
        tools arrive later.
      </p>
    </Panel>
  )
}
