import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
import { fileProtocolHtml } from "./scripts/file-protocol.ts"

// Build: relative base so qa can open dist over file:// and preview can serve
// dist/uikit/ under /uikit/. Dev (middleware under the app): absolute /uikit/ base.
export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/uikit/" : "./",
  plugins: [react(), tailwindcss(), fileProtocolHtml()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  build: {
    outDir: "../dist/uikit",
    emptyOutDir: true,
    assetsInlineLimit: (file) => /\.(woff2?|ttf)$/.test(file) ? true : undefined,
    modulePreload: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { format: "iife", entryFileNames: "assets/kit.js", assetFileNames: "assets/[name][extname]" } },
  },
}))
