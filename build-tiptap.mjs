import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import fs from 'fs';

const inputCode = `
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';

if (typeof window !== 'undefined') {
  window.TipTapBundle = {
    Editor,
    StarterKit,
    TaskList,
    TaskItem,
    Markdown
  };
}
export { Editor, StarterKit, TaskList, TaskItem, Markdown };
`;

fs.writeFileSync('tiptap-entry.js', inputCode);

async function build() {
  const bundle = await rollup({
    input: 'tiptap-entry.js',
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
        preventAssignment: true
      }),
      resolve({ browser: true }),
      commonjs()
    ]
  });

  const { output } = await bundle.generate({
    format: 'iife',
    name: 'TipTapBundle'
  });

  fs.writeFileSync('plugins/dsh-local-filetree/tiptap.bundle.js', output[0].code);
  console.log('[✓] TipTap Bundle built successfully! Size:', output[0].code.length);
}

build().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
