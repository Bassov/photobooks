/* Settings → Hosting classes shared by the manual form, the connected card and the guided setup. */

/** Kit error red (printProfiles.tsx ERR); the prod status tokens are grey. */
export const ERR = '#a8403a'
/* BOX / ring: the PrintProfileDialog field (private there). */
export const BOX =
  'flex h-8 items-center rounded-md bg-field px-2.5 text-sm text-foreground'
export function ring(error: boolean): string {
  return error
    ? 'shadow-none ring-1 ring-inset ring-[#a8403a]'
    : 'shadow-xs has-[input:focus-visible]:shadow-none has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-inset has-[input:focus-visible]:ring-[#535152]'
}
export const GHOST = 'px-3 text-sm'
export const OUTLINE = 'px-3 text-sm shadow-xs'
export const CARD = 'mt-5 max-w-[640px] overflow-hidden rounded-xl bg-chrome'
/** The 12 px text link of the mode switch. */
export const MODE_LINK =
  'mt-3 cursor-pointer border-0 bg-transparent p-0 pl-4 [font-family:inherit] text-xs text-foreground underline decoration-foreground/35 underline-offset-4'
