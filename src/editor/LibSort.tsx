import { Button as AriaButton } from 'react-aria-components'
import { Icon } from '../ui/Icon'
import { Menu, MenuItem, MenuPopover, MenuTrigger } from '../ui/Menu'
import type { LibrarySortKey } from './libraryBookFilter'

const SORTS: { id: LibrarySortKey; label: string }[] = [
  { id: 'edited', label: 'Last edited' },
  { id: 'title', label: 'Title' },
  { id: 'created', label: 'Created' },
]

/** Quiet library sort menu. */
export function LibSort({
  value,
  onChange,
}: {
  value: LibrarySortKey
  onChange: (value: LibrarySortKey) => void
}) {
  const cur =
    SORTS.find((item) => item.id === value) ??
    ({ id: 'edited' as const, label: 'Last edited' } as const)
  return (
    <MenuTrigger>
      <AriaButton
        className="pb-lib-quiet inline-flex cursor-default items-center gap-1.5 px-3.5"
        aria-label={`Sort books: ${cur.label}`}
        data-testid="lib-sort"
      >
        <span className="text-muted-foreground">Sort:</span> {cur.label}
        <Icon
          name="chevronDown"
          size={14}
          className="size-3.5 text-muted-foreground"
        />
      </AriaButton>
      <MenuPopover placement="bottom end" className="min-w-44">
        <Menu
          selectionMode="single"
          selectedKeys={[value]}
          onAction={(key) => {
            onChange(key as LibrarySortKey)
          }}
          data-testid="lib-sort-menu"
        >
          {SORTS.map((item) => (
            <MenuItem key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  )
}
