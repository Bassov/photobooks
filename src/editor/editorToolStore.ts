export type EditorTool = 'select' | 'frame' | 'text' | 'hand'

export const EDITOR_TOOLS: readonly EditorTool[] = [
  'select',
  'frame',
  'text',
  'hand',
]

/** Hotkey (lower-case key) → tool. */
export const EDITOR_TOOL_KEYS: Readonly<Record<string, EditorTool>> = {
  v: 'select',
  f: 'frame',
  t: 'text',
  h: 'hand',
}

type Listener = () => void

let tool: EditorTool = 'select'
const listeners = new Set<Listener>()

export function getEditorTool(): EditorTool {
  return tool
}

export function setEditorTool(next: EditorTool): void {
  if (next === tool) return
  tool = next
  listeners.forEach((l) => {
    l()
  })
}

export function subscribeEditorTool(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetEditorToolForTests(): void {
  tool = 'select'
}
