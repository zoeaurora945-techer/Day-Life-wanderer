import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'quadrant-review',
  date: '2026-8-16',
  designWidth: 750,
  deviceRatio: {
    640: 2.34,
    750: 1,
    828: 1.81,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    postcss: {
      autoprefixer: { enable: true },
      cssModules: { enable: false },
    },
  },
  h5: {
    postcss: {
      autoprefixer: { enable: true },
    },
  },
})
