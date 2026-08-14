# `dsh-local-filetree` Plugin Guide & Ultimate TipTap Suite

This folder contains setup instructions and feature patches for the **File Explorer & Ultimate TipTap 3 Suite** (`dsh-local-filetree`).

## 📌 Upstream Repository
* Original Repository: [`github:Mongfayi/dsh-local-filetree`](https://github.com/Mongfayi/dsh-local-filetree)

## 💡 Ultimate TipTap Suite Features:
* ⚡ **Notion-Style Slash Commands (`/`)**: Type `/` to open quick-insert menu:
  * Headings H1, H2, H3
  * Interactive Table (3x3 grid)
  * Code Block with live multi-language syntax highlighting
  * Task List (interactive todo checkboxes)
  * Embed YouTube Videos
  * Insert Images
  * Blockquotes and Horizontal Divider lines
* 📊 **Interactive Tables**: Insert tables (`@tiptap/extension-table`), add/remove rows and columns directly.
* 🎥 **YouTube Embeds**: Embed responsive YouTube video player from URL (`@tiptap/extension-youtube`).
* 🌈 **Code Syntax Highlighting**: Lowlight engine with live keyword coloring for Python, JS, TS, Go, Rust, Bash, HTML, CSS, JSON, YAML.
* 🎨 **Rich Formatting & Floating Tools**: Bold, Italic, Underline, Strikethrough, Highlight (`Mark`), Alignments.
* 🌳 **File Explorer Sidebar**: Color-coded VS Code file icons, folder tree, and file size badges.
* 💾 **Direct Disk Persistence**: Instant save with `Ctrl+S` or top Save button via `/filetree/read` & `/filetree/save` server APIs.

## 🚀 Installation & Patching

### 1. Install Upstream Plugin
```bash
dsh plugin --profile web add github:Mongfayi/dsh-local-filetree
```

### 2. Apply Ultimate TipTap Suite Patch
```bash
node plugins/dsh-local-filetree/patch.js
```
