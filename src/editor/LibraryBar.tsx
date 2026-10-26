import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { LibraryMark } from './LibraryMark'

/** Library top bar: brand · folder path + Change · settings. */
export function LibraryBar({
  path,
  onChange,
  onSettings,
  tools,
  changeDisabled,
  settingsDisabled,
}: {
  path: string
  onChange: () => void
  onSettings?: () => void
  tools?: ReactNode
  changeDisabled?: boolean
  settingsDisabled?: boolean
}) {
  return (
    <header
      className="relative z-10 flex h-14 shrink-0 items-center gap-6 bg-chrome px-6"
      data-testid="library-bar"
    >
      <LibraryMark />
      <div
        className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground"
        data-testid="library-card"
      >
        <Icon name="folder" size={16} className="size-4 shrink-0" />
        <span
          className="min-w-0 truncate font-mono text-xs text-foreground"
          title={path}
          data-testid="library-path"
        >
          {path}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 rounded-full px-2.5 text-sm font-medium text-muted-foreground"
          isDisabled={Boolean(changeDisabled)}
          onPress={onChange}
          data-testid="change-library"
        >
          Change library folder…
        </Button>
      </div>
      <div
        className="ml-auto flex shrink-0 items-center gap-2.5"
        data-testid="library-bar-tools"
      >
        {tools}
        {onSettings ? (
          <IconButton
            label="Settings"
            data-testid="library-settings"
            isDisabled={Boolean(settingsDisabled)}
            onPress={onSettings}
          >
            <Icon name="settings" size={16} />
          </IconButton>
        ) : null}
      </div>
    </header>
  )
}
