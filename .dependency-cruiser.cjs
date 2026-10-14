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
        'src/core must stay pure: no React/DOM UI modules or photo/perf/App imports.',
      severity: 'error',
      from: { path: '^src/core' },
      to: {
        path: ['^src/(photo|perf|App)', 'node_modules/(react|react-dom)(/|$)'],
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
