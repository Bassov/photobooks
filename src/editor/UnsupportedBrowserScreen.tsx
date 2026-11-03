import { useState } from 'react'
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components'
import { FeaturedIcon } from '../ui/FeaturedIcon'
import { Icon } from '../ui/Icon'
import {
  CHROME_DOWNLOAD_URL,
  CHROMIUM_BROWSERS,
  getBrowserSupport,
  UNSUPPORTED_SHARE_URL,
} from './browserSupport'
import { reloadUnsupportedPage } from './reloadUnsupportedPage'
import {
  resolveUnsupportedScreen,
  type UnsupportedScreenModel,
} from './unsupportedScreenModel'
import './UnsupportedBrowserScreen.css'

function CopyLink() {
  const [done, setDone] = useState(false)
  return (
    <AriaButton
      className="ub-btn ub-btn--secondary"
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
    </AriaButton>
  )
}

function GetChrome({ secondary }: { secondary: boolean }) {
  return (
    <AriaLink
      href={CHROME_DOWNLOAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="get-chrome"
      className={
        secondary ? 'ub-btn ub-btn--secondary' : 'ub-btn ub-btn--primary'
      }
    >
      Get Google Chrome
      <Icon name="externalLink" />
    </AriaLink>
  )
}

function BrowserList() {
  return (
    <>
      <ul className="ub-pills" data-testid="browser-list">
        {CHROMIUM_BROWSERS.map((b) => (
          <li key={b.name}>
            <AriaLink
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ub-pill"
              data-testid={`browser-link-${b.name}`}
            >
              {b.name}
              <Icon name="externalLink" />
            </AriaLink>
          </li>
        ))}
      </ul>
      {CHROMIUM_BROWSERS.filter((b) => b.flag !== undefined).map((b) => (
        <p key={b.name} className="ub-note">
          {b.name}: turn on <code className="ub-code">{b.flag}</code>, then
          relaunch.
        </p>
      ))}
    </>
  )
}

function TurnOnTips() {
  return (
    <ol className="ub-tips">
      <li>
        <b>Brave:</b> open{' '}
        <code className="ub-code">brave://flags/#file-system-access-api</code>,
        set it to Enabled, relaunch.
      </li>
      <li>
        <b>Managed computer:</b> ask your admin to allow{' '}
        <code className="ub-code">FileSystemAccess</code> for this site.
      </li>
      <li>
        <b>Embedded or http:</b> open{' '}
        <code className="ub-code">https://photobooks.app</code> directly in a
        tab.
      </li>
    </ol>
  )
}

function MobileBody() {
  return (
    <>
      <p className="ub-text">
        Photobooks edits books and photos right in folders on your disk. Phones
        and tablets — Chrome on Android and every browser on iPhone and iPad —
        can’t give a website that kind of folder access.
      </p>
      <p className="ub-text">
        Open it on a Mac, Windows or Linux computer in <b>Google Chrome</b>,
        Edge or another Chromium browser.
      </p>
      <div className="ub-actions">
        <CopyLink />
      </div>
      <p className="ub-foot">
        Published Photobooks sites open on any phone — only the editor needs a
        computer.
      </p>
    </>
  )
}

function DesktopBody({ model }: { model: UnsupportedScreenModel }) {
  return (
    <>
      <p className="ub-text">
        {model.showReload ? (
          <>
            This is a Chromium browser, but direct folder access (the File
            System Access API) isn’t available here. It may be switched off by a
            browser flag or by your organisation, or the page isn’t opened over
            a secure connection.
          </>
        ) : (
          <>
            Photobooks saves your books straight into a folder on your disk and
            reads photos from their folders. That needs direct folder access
            (the File System Access API), which only Chromium-based desktop
            browsers have. You’re using{' '}
            <b data-testid="browser-name">{model.browserName}</b>.
          </>
        )}
      </p>
      <div className="ub-actions">
        {model.showReload ? (
          <AriaButton
            className="ub-btn ub-btn--primary"
            data-testid="reload-after-enable"
            onPress={() => {
              reloadUnsupportedPage()
            }}
          >
            Reload after turning it on
          </AriaButton>
        ) : null}
        <GetChrome secondary={model.chromeSecondary} />
        {model.showCopyInActions ? <CopyLink /> : null}
      </div>
      <section className="ub-section">
        <p className="ub-eyebrow">
          {model.showReload
            ? 'Turn folder access back on'
            : 'Other Chromium browsers work too'}
        </p>
        {model.showBrowserList ? <BrowserList /> : <TurnOnTips />}
      </section>
      <p className="ub-foot">
        Nothing is uploaded — Photobooks runs entirely in your browser, on your
        own folders. Published Photobooks sites open in every browser.
      </p>
    </>
  )
}

export function UnsupportedBrowserScreen() {
  const model = resolveUnsupportedScreen(getBrowserSupport())

  return (
    <main
      className="ub-root"
      data-testid="unsupported-browser"
      data-narrow={model.showMobileLayout ? '' : undefined}
    >
      <div className="ub-scroll" data-testid="unsupported-scroll">
        <div className="ub-page">
          <header className="ub-header">
            <span className="ub-mark">
              <Icon name="bookOpen" size={14} />
            </span>
            Photobooks
          </header>
          <div className="ub-main">
            <div
              className="ub-body"
              data-testid="unsupported"
              data-variant={model.variant}
            >
              <FeaturedIcon
                size="md"
                theme="soft"
                color="warning"
                className="ub-icon"
              >
                <Icon name={model.icon} />
              </FeaturedIcon>
              <h1 className="ub-title" data-testid="unsupported-title">
                {model.title}
              </h1>
              {model.showMobileLayout ? (
                <MobileBody />
              ) : (
                <DesktopBody model={model} />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
