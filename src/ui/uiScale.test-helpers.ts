import { setUiScaleChoice, UI_SCALE_KEY, type UiScaleStep } from './uiScale'

/**
 * Test helper: runs the app at interface scale `s` through the real store (a
 * 3840×2160 window leaves room for every step). Returns the restore call:
 * window size, stored choice and the effective scale back to 1.
 */
export function runAtInterfaceScale(s: UiScaleStep): () => void {
  const start = { w: window.innerWidth, h: window.innerHeight }
  const setWindow = (w: number, h: number): void => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: w,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: h,
    })
  }
  setWindow(3840, 2160)
  setUiScaleChoice(s)
  return () => {
    setWindow(start.w, start.h)
    setUiScaleChoice(1)
    window.localStorage.removeItem(UI_SCALE_KEY)
  }
}
