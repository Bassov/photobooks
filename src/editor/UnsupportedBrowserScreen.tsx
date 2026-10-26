import { useState } from 'react'
import { Link as AriaLink } from 'react-aria-components'
import { cn } from '../ui/cn'
import { FeaturedIcon } from '../ui/FeaturedIcon'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/Button'
import {
  CHROME_DOWNLOAD_URL,
  CHROMIUM_BROWSERS,
  getBrowserSupport,
  UNSUPPORTED_SHARE_URL,
} from './browserSupport'
import { reloadUnsupportedPage } from './reloadUnsupportedPage'
import { resolveUnsupportedScreen } from './unsupportedScreenModel'

const extLink =
  'inline-flex items-center gap-1.5 rounded outline-hidden data-[hovered]:underline data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring'

const chromeButtonClass = (outline: boolean) =>
  cn(
    'inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium shadow-sm outline-hidden [&_svg]:size-4',
    'data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring',
    outline
      ? 'border border-border bg-background text-foreground data-[hovered]:bg-accent'
      : 'bg-primary text-primary-foreground data-[hovered]:opacity-90',
  )

function CopyLink({ className }: { className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="secondary"
      size="md"
      className={cn('gap-1.5 px-4 shadow-xs [&_svg]:size-4', className)}
      data-testid="copy-link"
      onPress={() => {
        void navigator.clipboard
          .writeText(UNSUPPORTED_SHARE_URL)
          .catch(() => undefined)
        setDone(true)
        window.setTimeout(() => {
          setDone(false)
        }, 1800)
      }}
    >
      <Icon name={done ? 'check' : 'copy'} />
      {done ? 'Link copied' : 'Copy link'}
    </Button>
  )
}

function UnsupportedBody({
  model,
}: {
  model: ReturnType<typeof resolveUnsupportedScreen>
}) {
  const { variant, browserName, title, icon, showMobileLayout } = model
  const body =
    variant === 'no-api' ? (
      <>
        This is a Chromium browser, but direct folder access (the File System
        Access API) isn’t available here. It may be switched off by a browser
        flag or by your organisation, or the page isn’t opened over a secure
        connection.
      </>
    ) : showMobileLayout ? (
      <>
        Photobooks edits books and photos right in folders on your disk. Phones
        and tablets — Chrome on Android and every browser on iPhone and iPad —
        can’t give a website that kind of folder access.
      </>
    ) : (
      <>
        Photobooks saves your books straight into a folder on your disk and
        reads photos from their folders. That needs direct folder access (the
        File System Access API), which only Chromium-based desktop browsers
        have. You’re using{' '}
        <b className="font-semibold text-foreground" data-testid="browser-name">
          {browserName}
        </b>
        .
      </>
    )

  return (
    <div
      className={cn(
        'flex w-full flex-col',
        showMobileLayout ? 'px-5 py-6' : 'max-w-[560px]',
      )}
      data-testid="unsupported"
      data-variant={variant}
    >
      <FeaturedIcon
        size={showMobileLayout ? 'lg' : 'xl'}
        theme="soft"
        color="warning"
        className="mb-5"
      >
        <Icon name={icon} />
      </FeaturedIcon>
      <h1
        className={cn(
          'heading leading-tight',
          showMobileLayout ? 'text-xl' : 'text-2xl',
        )}
        data-testid="unsupported-title"
      >
        {title}
      </h1>
      <p
        className={cn(
          'mt-2 leading-relaxed text-muted-foreground',
          showMobileLayout ? 'text-sm' : 'text-base',
        )}
      >
        {body}
      </p>
      {showMobileLayout ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Open it on a Mac, Windows or Linux computer in{' '}
            <b className="font-semibold text-foreground">Google Chrome</b>, Edge
            or another Chromium browser.
          </p>
          <CopyLink className="mt-5 w-full" />
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Published Photobooks sites open on any phone — only the editor needs
            a computer.
          </p>
        </>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {model.showReload ? (
              <Button
                size="md"
                className="gap-1.5 px-4 shadow-sm"
                data-testid="reload-after-enable"
                onPress={() => {
                  reloadUnsupportedPage()
                }}
              >
                Reload after turning it on
              </Button>
            ) : null}
            <AriaLink
              href={CHROME_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="get-chrome"
              className={chromeButtonClass(model.chromeOutline)}
            >
              Get Google Chrome
              <Icon name="externalLink" />
            </AriaLink>
            {model.showCopyInActions ? <CopyLink /> : null}
          </div>
          <div className="mt-7 overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
              {model.showReload
                ? 'Turn folder access back on'
                : 'Other Chromium browsers work too'}
            </div>
            {model.showBrowserList ? (
              <ul
                className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3"
                data-testid="browser-list"
              >
                {CHROMIUM_BROWSERS.map((b) => (
                  <li key={b.name} className="min-w-0 text-sm">
                    <AriaLink
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={extLink}
                      data-testid={`browser-link-${b.name}`}
                    >
                      {b.name}
                      <Icon
                        name="externalLink"
                        className="size-3 text-muted-foreground"
                      />
                    </AriaLink>
                    {b.note !== undefined ? (
                      <span className="block truncate text-2xs text-muted-foreground">
                        {b.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1.5 px-4 py-3 text-sm leading-relaxed">
                <li>
                  <b className="font-semibold">Brave:</b> open{' '}
                  <span className="font-mono text-xs">
                    brave://flags/#file-system-access-api
                  </span>
                  , set it to Enabled, relaunch.
                </li>
                <li>
                  <b className="font-semibold">Managed computer:</b> ask your
                  admin to allow{' '}
                  <span className="font-mono text-xs">FileSystemAccess</span>{' '}
                  for this site.
                </li>
                <li>
                  <b className="font-semibold">Embedded or http:</b> open{' '}
                  <span className="font-mono text-xs">
                    https://photobooks.app
                  </span>{' '}
                  directly in a tab.
                </li>
              </ul>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Nothing is uploaded — Photobooks runs entirely in your browser, on
            your own folders. Published Photobooks sites open in every browser.
          </p>
        </>
      )}
    </div>
  )
}

export function UnsupportedBrowserScreen() {
  const model = resolveUnsupportedScreen(getBrowserSupport())

  return (
    <main
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background text-foreground"
      data-testid="unsupported-browser"
    >
      <div className="pointer-events-none absolute left-5 top-4 z-10 flex items-center gap-2">
        <div className="grid size-6 place-items-center rounded-md bg-field text-foreground">
          <Icon name="bookOpen" className="size-3" />
        </div>
        <span className="text-base font-semibold">Photobooks</span>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto"
        data-testid="unsupported-scroll"
      >
        <div className="grid min-h-full place-items-center px-8 py-14">
          <UnsupportedBody model={model} />
        </div>
      </div>
    </main>
  )
}
