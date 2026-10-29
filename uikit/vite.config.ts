import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
import { fileProtocolHtml } from "./scripts/file-protocol.ts"

// Static kit that opens from disk (file://): relative base, one classic (non-module) bundle,
// fonts inlined into CSS, photos as relative files in photos/.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), fileProtocolHtml()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  build: {
    assetsInlineLimit: (file) => /\.(woff2?|ttf)$/.test(file) ? true : undefined,
    modulePreload: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { format: "iife", entryFileNames: "assets/kit.js", assetFileNames: "assets/[name][extname]" } },
  },
})
