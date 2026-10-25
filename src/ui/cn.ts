import { cva } from 'class-variance-authority'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Kit-compatible class merger (`clsx` + `tailwind-merge`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export { cva }
