import { defineConfig } from 'tsdown'
import { clientBundle } from './build/tsdown.client.ts'

export default defineConfig([
  // Target 1: Host Node.js Service
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node22',
    outDir: 'lib',
    clean: false,
    dts: true,
    fixedExtension: false,
  },
  // Target 2: Web Client UI Bundle
  clientBundle('@anoslide/dsh-vscode-workspace', {
    entry: 'src/client/index.ts',
    outDir: 'lib',
  }),
])
