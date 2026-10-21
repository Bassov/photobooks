import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { setTheme, useProductTheme } from '../ui/preferredTheme'

/** Top-bar moon/sun control; sole React subscriber to product theme. */
export function ThemeToggle() {
  const theme = useProductTheme()
  const toDark = theme === 'b'
  return (
    <IconButton
      className="editor-theme-toggle"
      data-testid="app-theme-toggle"
      label={toDark ? 'Dark theme' : 'Light theme'}
      size="sm"
      onPress={() => {
        setTheme(
          toDark ? 'b-dark' : 'b',
          document.documentElement,
          globalThis.localStorage,
        )
      }}
    >
      <Icon name={toDark ? 'moon' : 'sun'} size={16} />
    </IconButton>
  )
}
