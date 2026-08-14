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
import Collaboration from '@tiptap/extension-collaboration';
import { yCursorPlugin, defaultSelectionBuilder } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const lowlight = createLowlight(common);

const CollaborationCursor = Extension.create({
  name: 'collaborationCursor',
  addOptions() {
    return {
      provider: null,
      user: { name: null, color: null },
      render: user => {
        const cursor = document.createElement('span');
        cursor.classList.add('collaboration-cursor__caret');
        cursor.setAttribute('style', 'border-left: 2px solid ' + (user.color || '#3b82f6') + ';');
        const label = document.createElement('div');
        label.classList.add('collaboration-cursor__label');
        label.setAttribute('style', 'background-color: ' + (user.color || '#3b82f6') + ';');
        label.innerText = user.name || 'Anonymous';
        cursor.insertBefore(label, null);
        return cursor;
      },
      selectionRender: defaultSelectionBuilder,
    };
  },
  addProseMirrorPlugins() {
    if (!this.options.provider || !this.options.provider.awareness) return [];
    this.options.provider.awareness.setLocalStateField('user', this.options.user);
    return [
      yCursorPlugin(this.options.provider.awareness, {
        cursorBuilder: this.options.render,
        selectionBuilder: this.options.selectionRender,
      })
    ];
  }
});

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
    Markdown,
    Collaboration,
    CollaborationCursor,
    Y,
    WebsocketProvider
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
  Markdown,
  Collaboration,
  CollaborationCursor,
  Y,
  WebsocketProvider
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

  const targetPath = 'plugins/dsh-client-vscode-layout/assets/tiptap.bundle.js';
  fs.mkdirSync('plugins/dsh-client-vscode-layout/assets', { recursive: true });
  fs.writeFileSync(targetPath, output[0].code);
  if (fs.existsSync('tiptap-entry.js')) fs.unlinkSync('tiptap-entry.js');
  console.log('[✓] TipTap Suite Bundle built successfully at ' + targetPath + '! Size: ' + output[0].code.length + ' bytes');
}

build().catch(err => {
  if (fs.existsSync('tiptap-entry.js')) fs.unlinkSync('tiptap-entry.js');
  console.error('Build error:', err);
  process.exit(1);
});
