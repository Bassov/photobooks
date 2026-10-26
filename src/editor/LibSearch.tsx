import { Icon } from '../ui/Icon'

/** Quiet library search field (tone-only, no border). */
export function LibSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label
      className="pb-lib-quiet flex w-56 items-center gap-2 px-3.5"
      data-testid="lib-search"
    >
      <Icon
        name="search"
        size={16}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('')
          }
        }}
        placeholder="Search books"
        aria-label="Search books by title"
        className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        data-testid="lib-search-input"
      />
    </label>
  )
}
