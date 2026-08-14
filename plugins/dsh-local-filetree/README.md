# `dsh-local-filetree` Plugin Guide & TipTap Markdown Editor Patch

This folder contains setup instructions and feature patches for the **File Explorer & TipTap WYSIWYG Editor Plugin** (`dsh-local-filetree`).

## 📌 Upstream Repository
* Original Repository: [`github:Mongfayi/dsh-local-filetree`](https://github.com/Mongfayi/dsh-local-filetree)

## 💡 Enhanced Features in this Patch:
* 🌳 **File Explorer Sidebar**: View local workspace files and directories with color-coded VS Code file icons in English.
* 🖥️ **VS Code + Codex Layout**: Clicking any file opens it directly into the central workspace editor canvas with tabs, closing, and AI Chat toggle (no popup modals!).
* ✨ **TipTap-Style Rich WYSIWYG Markdown Editor**: Dedicated for `.md` files (ideal for both developers and non-technical writers):
  * Headings: H1, H2, H3.
  * Rich formatting: **Bold**, *Italic*, ~~Strikethrough~~.
  * Lists: Bullet lists, Numbered lists, and interactive Todo Checklists (`[x]`).
  * Blockquotes and Code Blocks.
  * Dual-mode switch: **`[ ✨ TipTap Rich WYSIWYG ]`** and **`[ 💻 Code Source ]`**.
* 💻 **Code Editor**: Syntax-styled editor for other programming languages (`.js`, `.py`, `.json`, `.go`, `.ts`, `.sh`, etc.) with tab-indentation and line numbers.
* 💾 **Direct Disk Persistence**: Instant save with `Ctrl+S` or top Save button via `/filetree/read` & `/filetree/save` server APIs.

## 🚀 Installation & Patching

### 1. Install Upstream Plugin
```bash
dsh plugin --profile web add github:Mongfayi/dsh-local-filetree
```

### 2. Apply English UI & TipTap Editor Patch
```bash
node plugins/dsh-local-filetree/patch.js
```
