import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { ensureLibraryScreenStyles } from './libraryScreenStyles'
import { listLibraryBooks } from './projectSession'
import { SettingsScreen } from './SettingsScreen'

// Back bar box and ink: `.pb-settings-back`, shared with the library Settings.
ensureLibraryScreenStyles()

/**
 * Settings opened from the editor top bar ⚙: full-window page with the kit
 * back bar "Back to the book" (uikit demo-parts/settings.tsx:84).
 */
export function EditorSettings({
  libraryPath,
  changeDisabled,
  onClose,
}: {
  libraryPath: string
  changeDisabled: boolean
  onClose: () => void
}) {
  const [bookCount, setBookCount] = useState(0)
  useEffect(() => {
    let live = true
    void listLibraryBooks().then((listed) => {
      if (live && listed.ok) {
        setBookCount(listed.value.length)
      }
    })
    return () => {
      live = false
    }
  }, [])
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-background"
      data-testid="editor-settings"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 bg-chrome px-3">
        <Button
          variant="ghost"
          size="sm"
          className="pb-settings-back h-8 gap-1 pl-1.5 pr-2.5 text-sm [&_svg]:size-4"
          onPress={onClose}
          data-testid="editor-settings-back"
        >
          <Icon name="chevronLeft" size={16} />
          Back to the book
        </Button>
        <span className="text-sm font-medium">Settings</span>
      </div>
      <div className="min-h-0 flex-1">
        <SettingsScreen
          libraryPath={libraryPath}
          bookCount={bookCount}
          changeDisabled={changeDisabled}
        />
      </div>
    </div>
  )
}
