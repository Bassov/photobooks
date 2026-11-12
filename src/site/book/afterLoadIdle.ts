/** what the gate reads of the window; `requestIdleCallback` is missing in Safari */
export type IdleWindow = Pick<
  Window,
  'document' | 'addEventListener' | 'setTimeout'
> & { requestIdleCallback?: Window['requestIdleCallback'] }

/** resolves on the first idle after `load` (a timer where there is no `requestIdleCallback`) */
export function afterLoadIdle(win: IdleWindow = window): Promise<void> {
  return new Promise<void>((resolve) => {
    const idle = () => {
      if (win.requestIdleCallback !== undefined) {
        win.requestIdleCallback(() => {
          resolve()
        })
      } else win.setTimeout(resolve, 1)
    }
    if (win.document.readyState === 'complete') idle()
    else win.addEventListener('load', idle, { once: true })
  })
}
