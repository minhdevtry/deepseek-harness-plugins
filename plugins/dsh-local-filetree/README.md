# `dsh-local-filetree` Plugin Guide & BlockNote Editor Patch

This folder contains setup instructions and feature patches for the **File Tree Explorer & File Editor Plugin** (`dsh-local-filetree`).

## 📌 Upstream Repository
* Original Repository: [`github:Mongfayi/dsh-local-filetree`](https://github.com/Mongfayi/dsh-local-filetree)

## 💡 Enhanced Features in this Patch:
* 🌳 **File Tree Explorer**: View local files and directories on the right panel in English.
* 📝 **Interactive Code & Text Editor**: Click any file (`.js`, `.json`, `.yml`, `.py`, `.txt`, etc.) to open, view, edit, and save with `Ctrl+S`.
* 🧱 **BlockNote-Style Markdown Editor**: For `.md` files, renders rich Notion/BlockNote-style interactive blocks:
  * Headers H1, H2, H3 with instant inline editing.
  * Interactive Todo Checkboxes (`[x]` / `[ ]`).
  * Bullet lists & Blockquotes.
  * Code blocks with syntax formatting.
  * Toggle between **BlockNote Mode** and **Raw Markdown Source**.
* 💾 **Direct File Persistence**: Integrated `/filetree/read` and `/filetree/save` server APIs.

## 🚀 Installation & Patching

### 1. Install Upstream Plugin
```bash
dsh plugin --profile web add github:Mongfayi/dsh-local-filetree
```

### 2. Apply English UI & BlockNote Editor Patch
```bash
node plugins/dsh-local-filetree/patch.js
```
