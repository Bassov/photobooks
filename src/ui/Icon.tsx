import { createElement, type ReactNode } from 'react'
import { ICON_GLYPHS, type IconName, type IconSize } from './icons/glyphs'
import './Icon.css'

export type { IconSize } from './icons/glyphs'
export { ICON_NAMES, ICON_SIZES } from './icons/glyphs'

export interface IconProps {
  name: IconName
  size?: IconSize
  className?: string
  /**
   * Accessible name for meaningful icons. Omit for decorative icons
   * (`aria-hidden`). Icon-only controls must supply a label (and tooltip)
   * on the control — see docs/design.md Iconography.
   */
  label?: string
}

function glyphChildren(name: IconName): ReactNode[] {
  return ICON_GLYPHS[name].map(([tag, attrs], i) =>
    createElement(tag, { ...attrs, key: `${tag}-${String(i)}` }),
  )
}

export function Icon({ name, size = 16, className, label }: IconProps) {
  const decorative = label === undefined
  const classes = ['pb-icon', className].filter(Boolean).join(' ')

  return (
    <svg
      className={classes}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-size={size}
      data-icon={name}
      focusable="false"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      {glyphChildren(name)}
    </svg>
  )
}
