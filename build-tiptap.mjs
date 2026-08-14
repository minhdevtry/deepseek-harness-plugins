import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import fs from 'fs';

const inputCode = `
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { FloatingMenu } from '@tiptap/extension-floating-menu';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';

const lowlight = createLowlight(common);

if (typeof window !== 'undefined') {
  window.TipTapBundle = {
    Editor,
    Extension,
    StarterKit,
    TaskList,
    TaskItem,
    Table,
    TableRow,
    TableCell,
    TableHeader,
    Image,
    Youtube,
    Underline,
    Highlight,
    Typography,
    TextAlign,
    Link,
    Color,
    TextStyle,
    BubbleMenu,
    FloatingMenu,
    CodeBlockLowlight,
    lowlight,
    Markdown
  };
}

export {
  Editor,
  Extension,
  StarterKit,
  TaskList,
  TaskItem,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  Image,
  Youtube,
  Underline,
  Highlight,
  Typography,
  TextAlign,
  Link,
  Color,
  TextStyle,
  BubbleMenu,
  FloatingMenu,
  CodeBlockLowlight,
  lowlight,
  Markdown
};
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
      resolve({ browser: true, preferBuiltins: false }),
      commonjs()
    ]
  });

  const { output } = await bundle.generate({
    format: 'iife',
    name: 'TipTapBundle'
  });

  fs.writeFileSync('plugins/dsh-local-filetree/tiptap.bundle.js', output[0].code);
  console.log('[✓] Ultimate TipTap Suite Bundle built successfully! Size:', output[0].code.length);
}

build().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
