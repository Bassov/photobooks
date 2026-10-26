import { Icon } from '../ui/Icon'

/** Photobooks mark — shared by Welcome / Library bar. */
export function LibraryMark() {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground">
      <div className="grid size-6 place-items-center rounded-md bg-field text-foreground">
        <Icon name="bookOpen" size={14} className="size-3.5" />
      </div>
      Photobooks
    </div>
  )
}
