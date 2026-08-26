# `@anoslide/dsh-client-vscode-layout`

> **Unified 3-Column VS Code Workspace, TipTap Notion WYSIWYG Suite, and AI Chat Integration for DeepSeek Harness.**

---

## 🌟 Overview

`@anoslide/dsh-client-vscode-layout` is a rich client-side frontend plugin for [DeepSeek Harness (`dsh`)](https://github.com/deepseek-ai/deepseek-harness). It transforms the default single-pane experience into a full-featured, productive 3-column VS Code-style development environment with Notion-like rich document editing and native AI chat capabilities.

---

## 🧩 Architectural Seams & Host Integrations

This plugin is designed around clean, non-invasive integration seams with the host core:

1. **Host Rail & Sidebar Integration (`sidebar.footer.action`)**:
   - Preserves the host's native 56px rail with Brand row, New Session, Search Sessions, and Settings.
   - Adds Explorer (`Ctrl+Shift+E`), Global Search (`Ctrl+Shift+F`), and Source Control (`Ctrl+Shift+G`) beside the rail.
   - `Ctrl+B` collapses the sidebar to the rail rather than hiding everything.

2. **Host `@` Mention Autocomplete (`ctx.inputTriggers.registerSource`)**:
   - Registers a `files` source in the chat composer's native `@` mention menu.
   - File search is executed asynchronously across workspace files.
   - Selecting a candidate inserts an authentic **Blue Occurrence Reference Chip** (`\uFFFC`) backed by the host's `Occurrence` system and `codec.serialize`.

3. **Smart `Ctrl+L` & Mention Writer (`ctx.conversation.input.for(actx)`)**:
   - Writes directly to the host's composer state via `setDraft` and `insertReference`.
   - **With selection in editor**: Sends an authentic blue reference chip (e.g. `@ARCHITECTURE.md#L36-43`) and focuses the composer.
   - **Without selection**: Toggles the chat panel open/closed without stealing focus.

4. **Multi-Tab Workbench & Opener Seam (`installWorkbenchOpener`)**:
   - Intercepts clicks on workspace files, chat links, and breadcrumbs to open tabs directly in the multi-tab editor.
   - Markdown documents (`.md`) render in the **TipTap Notion WYSIWYG Suite**.
   - Code documents render with **Shiki syntax highlighting** and line numbers.

---

## 📝 TipTap Notion WYSIWYG Suite

Markdown files are edited directly with Notion-level visual fidelity:

- **Collapsible Toggle Lists (`/toggle`)**: Details & Summary blocks that collapse and expand cleanly.
- **Notion Callouts (`/callout` or `💡`)**: Colored callout blocks with customizable emoji icons.
- **Floating Selection Bubble Menu**:
  - Formatting: **Bold**, *Italic*, <u>Underline</u>, ~~Strikethrough~~, `Inline Code`, Text & Highlight colors.
  - `💬 Mention in Chat`: Sends the active selection directly into the chat composer as `@filename#Lstart-end`.
  - `🤖 Ask AI`: Opens the inline Cursor-style AI assist card over selection.
- **Slash Commands (`/`)**:
  - Headings (`H1`, `H2`, `H3`), Collapsible Toggles (`/toggle`), Task Lists (`[ ]`), Tables, Callouts (`💡`), Code Blocks with Lowlight syntax highlighting, Blockquotes, Images, Dividers, and YouTube embeds.
- **Interactive Tables**: Add/delete columns and rows dynamically, drag resize, and toggle header highlights.
- **Outline TOC Drawer (`📑 Outline`)**: Real-time hierarchical table of contents with click-to-scroll.
- **1-Click Export Suite (`📤 Export`)**:
  - Copy Clean Markdown
  - Copy Formatted HTML
  - Print / PDF Preview (`window.print()`)

---

## 🤖 Phase 1 AI Code Review

Unified merge view & hunk-by-hunk AI code review powered by `@codemirror/merge`:

- **Inline Merge View & Diffs**: Visually marks deletions and insertions inline or in the gutter.
- **Action Buttons (`[✓ Giữ]` / `[✕ Bỏ]`)**: Accept or reject changes per hunk directly inside the editor.
- **Baseline Undo Stack**: Robust undo support for Accept actions via `baselineSnapshots` and compartment re-arming.
- **Review Toolbar**:
  - `[✓ Giữ tất cả]`: Batch accepts all hunks.
  - `[✕ Bỏ tất cả]`: Batch rejects all hunks back to pre-AI baseline.
  - `[↺ Hoàn tác]`: Step backward through review actions.
  - `[↑ Trước]` / `[↓ Sau]`: Jump smoothly between changed hunks.
  - `[✕ Đóng]`: Closes review mode and autosaves if any rejects occurred.
- **Global API**: Trigger programmatic reviews with `window.__dsh_start_ai_review(path, baselineText)`.

---

## ⌨️ Keybindings Reference

| Keybinding | Scope | Description |
| :--- | :--- | :--- |
| `Ctrl+K` / `Cmd+K` | Editor Selection | Opens Cursor-style Floating Inline AI Assist card. |
| `Ctrl+L` / `Cmd+L` | Global / Editor | **With selection:** Inserts `@file#L36-43` chip into chat and focuses.<br>**Without selection:** Toggles chat panel open/close. |
| `Ctrl+Shift+P` / `F1` | Global | Opens Command Palette. |
| `Ctrl+P` / `Cmd+P` | Global | Quick Open File fuzzy picker. |
| `Ctrl+Shift+E` | Global | Focuses Explorer view. |
| `Ctrl+Shift+F` | Global | Focuses Global Search view. |
| `Ctrl+Shift+G` | Global | Focuses Source Control view. |
| `Ctrl+B` | Global | Toggles Sidebar (collapses to rail). |
| `Ctrl+S` / `Cmd+S` | Editor | Saves active document to disk. |
| `Ctrl+Z` / `Ctrl+Y` | Editor | Undo / Redo history in Code & TipTap editors. |
| `F2` | Explorer | Inline file/folder rename. |

---

## 🧪 Testing & Building

Run the unit test suite (170+ tests covering line range arithmetic, reference chip serialization, mention formatting, and TipTap nodes):

```bash
# Typecheck
npm run typecheck

# Unit tests
npm run test:unit

# Build client bundle
npm run build
```

---

## 📄 License

MIT © [minhdevtry](https://github.com/minhdevtry)
