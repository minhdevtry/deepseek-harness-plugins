
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
  BubbleMenu,
  FloatingMenu,
  CodeBlockLowlight,
  lowlight,
  Markdown
};
