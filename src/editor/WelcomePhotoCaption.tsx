import { cn } from '../ui/cn'
import { LICENSE_URL, WELCOME_CREDITS } from './welcomeCredits'

/** Plain CC BY-SA caption — no capsule (kit v0.9 §1). */
export function WelcomePhotoCaption({
  id,
  testid = 'photo-credit',
  className = '',
}: {
  id: string
  testid?: string
  className?: string
}) {
  const credit = WELCOME_CREDITS[id]
  if (!credit) {
    return null
  }
  const licenseHref = LICENSE_URL[credit.license]
  // Inline: the unlayered global `a { color }` beats the layered `[&_a]:text-inherit`.
  const linkStyle = { color: 'inherit' }
  return (
    <p
      className={cn(
        'm-0 text-2xs leading-4 text-muted-foreground [&_a]:rounded-xs [&_a]:text-inherit [&_a]:no-underline [&_a]:outline-hidden [&_a:hover]:underline [&_a:hover]:underline-offset-2 [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-ring',
        className,
      )}
      data-testid={testid}
      data-photo={id}
      title={credit.title}
    >
      Photo:{' '}
      <a
        href={credit.url}
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
      >
        {credit.author}
      </a>{' '}
      ·{' '}
      {licenseHref ? (
        <a
          href={licenseHref}
          target="_blank"
          rel="noopener noreferrer license"
          style={linkStyle}
        >
          {credit.license}
        </a>
      ) : (
        credit.license
      )}{' '}
      · modified
    </p>
  )
}
