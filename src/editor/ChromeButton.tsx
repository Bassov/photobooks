import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import '../ui/Button.css'
import { SUB } from './editorChromeTokens'

/** Top bar ghost button (Preview, Settings, Export site pills share it). */
export function ChromeButton({
  size = 'sm',
  className,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'md'
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      className={[
        'pb-button',
        'pb-button--secondary',
        'e7-ghost',
        `pb-button--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        color: SUB,
        background: 'transparent',
        border: 0,
        boxShadow: 'none',
        ...style,
      }}
      {...props}
    />
  )
}
