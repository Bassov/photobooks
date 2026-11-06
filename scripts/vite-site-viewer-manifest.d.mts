import type { Plugin } from 'vite'

/** Emit `site-viewer.json` listing the built site viewer files. */
export function siteViewerManifestPlugin(entryName: string): Plugin
