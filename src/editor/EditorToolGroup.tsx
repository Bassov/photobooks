import { useSyncExternalStore } from 'react'
import { ToggleButtonGroup } from 'react-aria-components'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/icons/glyphs'
import { ToggleButton } from '../ui/ToggleButton'
import { Tooltip, TooltipTrigger } from '../ui/Tooltip'
import {
  EDITOR_TOOLS,
  getEditorTool,
  setEditorTool,
  subscribeEditorTool,
  type EditorTool,
} from './editorToolStore'
import './EditorToolGroup.css'

const TOOL_META: Record<EditorTool, { icon: IconName; label: string }> = {
  select: { icon: 'select', label: 'Select (V)' },
  frame: { icon: 'frame', label: 'Frame (F)' },
  text: { icon: 'text', label: 'Text (T)' },
  hand: { icon: 'hand', label: 'Pan (H)' },
}

/** Kit ToolGroup: single-select pill in the header toolbar. */
export function EditorToolGroup() {
  const tool = useSyncExternalStore(
    subscribeEditorTool,
    getEditorTool,
    getEditorTool,
  )
  return (
    <ToggleButtonGroup
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[tool]}
      onSelectionChange={(keys) => {
        const next = [...keys][0]
        if (next) setEditorTool(next as EditorTool)
      }}
      aria-label="Tool"
      data-testid="tool-group"
      className="e7-tool-group"
    >
      {EDITOR_TOOLS.map((id) => (
        <TooltipTrigger key={id}>
          <ToggleButton
            id={id}
            size="sm"
            aria-label={TOOL_META[id].label}
            data-testid={`tool-${id}`}
            className="e7-tool"
          >
            <Icon name={TOOL_META[id].icon} size={16} />
          </ToggleButton>
          <Tooltip>{TOOL_META[id].label}</Tooltip>
        </TooltipTrigger>
      ))}
    </ToggleButtonGroup>
  )
}
