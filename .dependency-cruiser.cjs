/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'lib-is-pure',
      comment:
        'src/lib must stay DOM/framework-free and must not import photo UI or App.',
      severity: 'error',
      from: { path: '^src/lib' },
      to: {
        path: ['^src/(photo|perf|App)', 'node_modules/(react|react-dom)(/|$)'],
      },
    },
    {
      name: 'core-is-pure',
      comment:
        'src/core must stay pure: no React/DOM UI modules or photo/perf/App/render imports.',
      severity: 'error',
      from: { path: '^src/core' },
      to: {
        path: [
          '^src/(photo|perf|App|editor|render|project|assets)',
          'node_modules/(react|react-dom)(/|$)',
        ],
      },
    },
    {
      name: 'render-no-platform',
      comment:
        'src/render paints resolved items only and must not import editor, photo, or platform modules.',
      severity: 'error',
      from: { path: '^src/render' },
      to: {
        path: ['^src/(editor|photo|project|publish|perf|App|assets)'],
      },
    },
    {
      name: 'assets-no-react',
      comment:
        'src/assets is domain/platform adapters and must not import React or App UI.',
      severity: 'error',
      from: { path: '^src/assets' },
      to: {
        path: ['^src/(App|editor)', 'node_modules/(react|react-dom)(/|$)'],
      },
    },
    {
      name: 'photo-helpers-no-react',
      comment:
        'Pure photo helpers must not import React (keep them unit/mutation-testable).',
      severity: 'error',
      from: {
        path: '^src/photo/(aspectRatio|formatBytes|mime|normalizeOrientation|jpegSof|exifSchema|exifOrientationLabel)\\.ts$',
      },
      to: {
        path: 'node_modules/(react|react-dom)(/|$)',
      },
    },
    {
      name: 'src-no-uikit',
      comment:
        'App src must not import the uikit workspace package (reference-only).',
      severity: 'error',
      from: { path: '^src/' },
      to: {
        path: '(^uikit/|photobooks-ui-kit)',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.app.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
}
