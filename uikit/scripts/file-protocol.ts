import type { Plugin } from "vite"
// Chrome blocks <script type="module"> on file:// (origin "null"). The bundle is IIFE, so
// load it as a classic deferred script and drop crossorigin attributes.
export function fileProtocolHtml(): Plugin {
  return {
    name: "file-protocol-html",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
        .replace(/<script type="module" src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
        .replace(/ crossorigin/g, "")
    },
  }
}
