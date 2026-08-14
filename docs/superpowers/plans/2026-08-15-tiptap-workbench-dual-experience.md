# Dual Developer / Notion TipTap Suite & DSH Workbench Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a best-in-class dual-experience workbench for DeepSeek Harness that delivers a seamless VSCode-grade code editing workspace for developers alongside an intuitive, rich Notion-grade TipTap WYSIWYG note and document editor for non-coders, tightly integrated with local files, AI sessions, and MCP tools.

**Architecture:** Extend `dsh-local-filetree` with a modular architecture featuring a multi-tab file workbench, a floating bubble formatting toolbar, Notion-like callout blocks, table cell manipulation (merge/split/background), and an AI selection bridge to send document snippets directly to chat.

**Tech Stack:** React, TipTap 3 Suite, ProseMirror, Rollup, CSS Glassmorphism/Tailwind tokens, DeepSeek Harness Plugin System.

## Global Constraints

- **Language:** Code, comments, UI text, and commit messages MUST be in English.
- **Independence:** File Explorer and Editor MUST work directly in the browser without external cloud dependencies.
- **Dual Support:** Markdown files (`.md`) default to TipTap WYSIWYG Suite; code files (`.js`, `.py`, `.json`, etc.) default to Monaco/Code Source view.
- **Sync:** Changes in either mode must instantly persist to the local filesystem via `/filetree/save` API.

---

## 🔬 Comparative Analysis & Feature Selection

### Part 1: Selected Features from `hunghg255/reactjs-tiptap-editor` (Notion Suite)

| Feature | Description | Priority |
| :--- | :--- | :--- |
| **1. Selection Bubble Menu** | Floating formatting pill appearing when highlighting text with Bold, Italic, Strikethrough, Color, Highlight, Inline Code, and Link. | **P0 (Must Have)** |
| **2. Notion Callout / Alert Blocks** | Callout blocks with custom emoji icon (`💡 Note`, `🚀 Tip`, `⚠️ Warning`, `🛑 Danger`) and soft pastel backgrounds. | **P0 (Must Have)** |
| **3. Advanced Table Cell Operations** | Contextual cell operations: Merge cells (`mergeCells`), Split cells (`splitCell`), Set cell background color, and Auto column resize. | **P1 (High)** |
| **4. Live Word & Reading Time Counter** | Subtle footer badge showing word count, character count, and estimated reading time (e.g. `245 words · 1 min read`). | **P1 (High)** |
| **5. Image Resizing & Alignment Controls** | Click image to show quick size toggles (`25%`, `50%`, `100%`) and Alignment (`Left`, `Center`, `Right`). | **P2 (Nice to Have)** |
| **6. Emoji Auto-Complete (`:emoji:`)** | Typing `:smile` or `:rocket:` shows quick inline emoji completion. | **P2 (Nice to Have)** |

---

### Part 2: Selected Features from `Dpf555/dsh-workbench` & `Civitasv/dsh-plugin-open-editor` (Workbench & IDE)

| Feature | Description | Priority |
| :--- | :--- | :--- |
| **1. Multi-Tab Editor Workspace** | Open multiple files in tabs at once (`note.md`, `app.py`, `package.json`), switch between active tabs, close tabs (`✕`), and show unsaved dirty indicators (`•`). | **P0 (Must Have)** |
| **2. File Management Actions in Explorer** | Quick action toolbar in File Explorer: `➕ New File`, `📁 New Folder`, `✏️ Rename`, `🗑️ Delete File/Folder`. | **P0 (Must Have)** |
| **3. Split Pane & Resizable Panels** | Flexible 3-column layout: `[File Explorer (240px)] | [Editor (Flexible)] | [AI Chat Panel (Flexible)]` with drag handles to resize or toggle Zen mode. | **P1 (High)** |
| **4. AI Selection Action Bridge** | Select any text/code in Editor $\rightarrow$ Click floating button `🤖 Ask AI about selection` or `⚡ Explain / Refactor / Summarize` $\rightarrow$ Sends prompt directly into active chat session. | **P1 (High)** |
| **5. Quick File Filter / Search in Tree** | Search input at top of File Explorer to quickly find files by name in nested folders. | **P1 (High)** |

---

## 📋 Task Decomposition

### Task 1: Multi-Tab Editor Management & File Lifecycle
**Files:**
- Modify: `plugins/dsh-local-filetree/patch.js`
- Test: `test-workbench-tabs.mjs`

**Interfaces:**
- Consumes: `/filetree/read`, `/filetree/save`, `/filetree/list`
- Produces: `openTabs: Array<{ path, name, content, isDirty, mode }>`, `activeTabPath: string`

- [ ] **Step 1: Write Playwright test for opening multiple files in tabs and switching tabs**
- [ ] **Step 2: Implement `openTabs` state and tab bar with tab close (`✕`) and dirty indicator (`•`)**
- [ ] **Step 3: Run Playwright test to verify tab switching and closing**
- [ ] **Step 4: Commit changes**

---

### Task 2: Notion Selection Bubble Menu (Floating Formatting Pill)
**Files:**
- Modify: `build-tiptap.mjs` (bundle BubbleMenu extension)
- Modify: `plugins/dsh-local-filetree/patch.js`
- Test: `test-bubble-menu.mjs`

**Interfaces:**
- Consumes: `BubbleMenu` from `@tiptap/extension-bubble-menu`
- Produces: Floating menu DOM component visible on text selection

- [ ] **Step 1: Write Playwright test for highlighting text and checking bubble menu presence**
- [ ] **Step 2: Implement Caret-aligned Bubble Menu with Bold, Italic, Strike, Code, Highlight, and AI Action**
- [ ] **Step 3: Run Playwright test to verify formatting application via Bubble Menu**
- [ ] **Step 4: Commit changes**

---

### Task 3: Notion Callout / Alert Block Extensions
**Files:**
- Modify: `plugins/dsh-local-filetree/patch.js`
- Test: `test-callout-blocks.mjs`

**Interfaces:**
- Consumes: Custom ProseMirror Node / Blockquote configuration
- Produces: `/callout` or `> [!NOTE]` rendered as styled pastel callout boxes

- [ ] **Step 1: Write Playwright test for inserting `/callout` and checking icon & pastel background**
- [ ] **Step 2: Add Callout item to Slash Menu and render Callout blocks with emoji selector**
- [ ] **Step 3: Run Playwright test to verify callout creation**
- [ ] **Step 4: Commit changes**

---

### Task 4: File Explorer Operations (`➕ New File`, `📁 New Folder`, `🗑️ Delete`)
**Files:**
- Modify: `plugins/dsh-local-filetree/patch.js` (Server & Client)
- Test: `test-file-operations.mjs`

**Interfaces:**
- Consumes: `/filetree/create` and `/filetree/delete` HTTP routes
- Produces: Sidebar file action buttons and confirmation modals

- [ ] **Step 1: Write Playwright test for creating a new file and deleting a file**
- [ ] **Step 2: Implement server routes for file/folder creation and deletion**
- [ ] **Step 3: Implement client UI buttons in the File Explorer header**
- [ ] **Step 4: Run Playwright test to verify end-to-end file creation and deletion**
- [ ] **Step 5: Commit changes**

---

### Task 5: AI Selection Action Bridge (Editor ↔ Chat Integration)
**Files:**
- Modify: `plugins/dsh-local-filetree/patch.js`
- Test: `test-ai-bridge.mjs`

**Interfaces:**
- Consumes: Active chat input element or DSH event bus
- Produces: `sendToChat(selectedText, promptType)`

- [ ] **Step 1: Write Playwright test for selecting text in TipTap and clicking "Ask AI"**
- [ ] **Step 2: Implement `sendToChat` helper that populates the chat textarea and triggers submit**
- [ ] **Step 3: Run Playwright test to verify prompt injection into chat session**
- [ ] **Step 4: Commit changes**

---

## 🎯 Verification Plan

### Automated Playwright Tests
- `node test-workbench-tabs.mjs` — Tests opening, switching, and closing multiple file tabs.
- `node test-bubble-menu.mjs` — Tests text selection and bubble menu actions.
- `node test-callout-blocks.mjs` — Tests callout block insertion via slash command.
- `node test-file-operations.mjs` — Tests creating and deleting files from the explorer.
- `node test-ai-bridge.mjs` — Tests sending highlighted text to the active chat session.

### Manual Verification
- Open Web UI at `http://127.0.0.1:3080`.
- Verify dual experience: coder editing source code in one tab, non-coder enjoying Notion-style rich text in another tab.
