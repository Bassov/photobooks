// Resolve a Chrome/Chromium binary for the headless scripts: $CHROME_PATH, then common install locations.
import fs from "node:fs"
export function chromePath() {
  const c = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean)
  const hit = c.find((p) => fs.existsSync(p))
  if (!hit) throw new Error("Chrome not found: set CHROME_PATH to a Chrome/Chromium binary")
  return hit
}
