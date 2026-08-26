# DeepSeek Harness Plugins (`deepseek-harness-plugins`)

> **Unified 3-Column VS Code Layout, TipTap Notion WYSIWYG Suite, and Advanced Productivity Plugins for [DeepSeek Harness (`dsh`)](https://github.com/deepseek-ai/deepseek-harness).**

---

## 🌟 Key Features (All-in-One Non-Dev & Dev Workspace)

### 1. 🖥️ Professional 3-Column VS Code IDE Layout
- **Left Sidebar (280px)** — the host's own sidebar keeps the column; these views sit beside its 56px rail:
  - 🐋 **Host rail (unchanged)**: the shipped `ui-sidebar` renders its brand row, New Session, workspace controls (search sessions, add workspace) and **Settings** exactly as it does in the stock shell. This plugin *adds* to that rail through the `sidebar.footer.action` seat — it re-implements none of it.
  - 📁 **Explorer (`Ctrl+Shift+E`)**: Workspace file tree with Git status badges (`M`, `U`, `A`, `D`, `R`), hidden files toggle (`👁`), and manual path navigation.
  - 🔍 **Search (`Ctrl+Shift+F`)**: Fast recursive full-text workspace grep with match count badges, line numbers, and click-to-jump. A *mode*, not a permanent tab — VS Code's convention.
  - ⑂ **Source Control (`Ctrl+Shift+G`)**: stage, unstage, discard and commit.
  - 💬 **Sessions**: the host's *own* panel toggle at the top of the column switches to it — no duplicate button in the rail — and it hands the whole column back to the host's sidebar at full width. `Ctrl+B` collapses to the rail rather than to zero, so the host's controls are never off screen.
- **Center Workspace (Multi-Tab Editor)**:
  - Independent tabs with drag-and-drop reordering, active highlighting, and dirty state indicators (`•` unsaved dot).
  - High-performance server-side syntax highlighting powered by **Shiki** (`github-dark` / `github-light`).
  - **Interactive Breadcrumb Navigation**: Clickable directory hierarchy above the editor for rapid folder navigation.
  - **Bottom Status Bar**: Live Git branch (`🌿 main`), active file, line/word counters, UTF-8 encoding, language mode badge, `💾 Auto-Save: ON/OFF` toggle, and quick `⚡ Diff` toggle.
  - Right-click Tab Context Menu (`Close`, `Close Others`, `Close to the Left/Right`, `Close All`, `📋 Copy Path`).
- **Right Column (AI Chat & Tool Trajectory)**:
  - Integrated chat assistant and real-time tool execution logs.
  - 1-Click toggle between **Full-Width Canvas** and **3-Column IDE Layout** (`Ctrl+L`).
  - Floating **Open Chat** pill button when the panel is collapsed.

---

### 2. ⚡ Inline AI Code Assistant & Chat Integration
- **Inline AI Assistant (`Ctrl+K` like Cursor IDE)**:
  - Highlight any text, paragraph, or code lines and press `Ctrl+K`.
  - Floating glassmorphism card appears with quick action chips (`⚡ Polish Text`, `📊 Format Table`, `💡 Summarize`, `🔧 Refactor Code`) or custom natural language instructions.
- **`@` Mention File Autocomplete & Authentic Blue Reference Chips**:
  - Type `@` in the chat input: workspace files appear inside the host's own `@` menu (`files` group) with search-by-filename and path hint.
  - Selecting a file candidate inserts an authentic **Blue Reference Chip** (`OccurrenceChip`) directly into the composer.
  - Mentions automatically format with pure filename (`@ARCHITECTURE.md`) and precise line ranges (`#L36-43`, `#L6`) when text is selected in the active editor.
- **`Ctrl+L` Smart Chat Navigation & Mentions**:
  - **With selection in editor**: Inserts an authentic reference chip (e.g. `@ARCHITECTURE.md#L36-43` or `@AppFrame.tsx#L2-6`) into chat and focuses the composer.
  - **Without selection**: Instantly toggles the Right Chat panel open or closed without stealing editor focus.
- **TipTap WYSIWYG `💬 Mention` Bubble Button**:
  - Any selection in TipTap or Code editor can be sent directly to chat as a reference chip with 1 click from the selection bubble menu.
- **1-Click "⚡ Apply to Tab" & "📋 Copy" on Chat Code Blocks**:
  - Every code block in AI responses has action buttons to apply directly to the open file or copy to clipboard.
- **AI Assist Quick Actions Menu (`🤖 AI Assist ▾`)**:
  - `📖 Explain Code / File`: Injects deep architectural breakdown prompt.
  - `🧪 Generate Unit Tests`: Generates comprehensive unit tests for current file.
  - `🔧 Refactor & Optimize`: Suggests clean refactorings and modern optimizations.
  - `📝 Generate JSDoc / Docs`: Creates documentation and inline comments.
  - `🔍 Code Review & Bug Check`: Performs thorough review for edge cases and security.
- **Click-to-Open from AI Chat**: Any file paths or tool outputs mentioned in chat (e.g. `src/app.js`, `package.json`, `note.md`) are automatically interactive and open directly in an editor tab upon click.
- **Built-in Diff Viewer (`⚡ Diff`)**:
  - Compare unsaved changes or AI modifications side-by-side / unified with syntax-highlighted additions (`+ green`) and deletions (`- red`).
  - Change statistics counter (`+12 -4`).
  - 1-Click `✓ Accept Changes` and `✕ Discard` actions.
- **Robust Undo / Redo (`Ctrl+Z`, `Ctrl+Shift+Z` / `Ctrl+Y`)**:
  - Full history stack in both raw code editor and TipTap WYSIWYG editor so you never lose typing history.
  - Dedicated `↺ Undo` and `↻ Redo` buttons in the toolbar.

---

### 3. 🎨 Sleek In-App Modal Dialogs (No Ugly Browser Alerts)
- **Unsaved Changes Dialog**: When closing dirty tabs or discarding unsaved work, a modern in-app dialog appears with 3 clear options:
  - 💾 **Save** (`Enter`): Saves the file to disk and closes the tab.
  - 🗑️ **Don't Save**: Discards unsaved modifications and closes the tab.
  - ✕ **Cancel** (`Escape`): Keeps the file open.
- **Trash Confirmation Dialog**: Clean modal confirmation when moving files or folders to Trash.

---

### 4. 📝 TipTap Notion WYSIWYG Markdown & Document Suite
- **Direct WYSIWYG Editing**: Markdown files (`.md`) render directly into rich interactive Notion-style blocks.
- **Collapsible Toggle Lists (`/toggle`)**: Foldable summary/details blocks matching Notion's UX.
- **Notion Callouts (`/callout` or `💡`)**: Beautiful highlighted callout boxes with custom icons.
- **Document Outline TOC (`📑 Outline`)**: Instant drawer showing hierarchical H1, H2, and H3 headings with click-to-scroll navigation.
- **1-Click Export Suite (`📤 Export`)**:
  - `📋 Copy Clean Markdown`
  - `📋 Copy Formatted HTML`
  - `📄 Print / PDF Preview` (`window.print()`)
- **Intelligent Auto-Save Engine**: 1.5-second debounce silently persists document edits to disk with subtle `Saved ✓` indicator.
- **Floating Selection Bubble Menu**: Highlight text to format: **Bold** (`B`), *Italic* (`I`), <u>Underline</u> (`U`), ~~Strikethrough~~ (`S`), `Inline Code` (`</>`), 🎨 Text & Highlight Colors, `💬 Mention in Chat`, and `🤖 Ask AI`.
- **Slash Menu (`/`)**: Type `/` anywhere to insert Headings (H1/H2/H3), Collapsible Toggle Lists (`/toggle`), Task Lists (`[ ]`), Tables, Notion Callouts (`💡`), Code Blocks with syntax highlighting, Blockquotes, YouTube Embeds, Images, and Dividers.
- **Interactive Tables**: Add/delete rows and columns dynamically, toggle header row formatting.
- **Document Statistics**: Live word count and character count in the editor footer and status bar.

---

### 5. ⚡ Power-User Keyboard Shortcuts & Command Palette

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Ctrl+K` / `Cmd+K` | **Inline AI Assist** | Floating AI prompt input over selected text or code. |
| `Ctrl+Shift+P` / `F1` | **Command Palette** | Floating searchable palette for all editor commands and AI actions. |
| `Ctrl+P` / `Cmd+P` | **Quick Open File** | Centered floating palette with fuzzy search across all workspace files. |
| `Ctrl+Shift+F` | **Global Search** | Activates the Workspace Search panel with match case (`Aa`) and regex (`.*`). |
| `Ctrl+F` | **Find in File** | In-editor search widget with match counter and previous/next navigation. |
| `Ctrl+H` | **Find & Replace** | Expands in-editor find widget with single and replace-all controls. |
| `Ctrl+Z` | **Undo** | Reverts recent typing/formatting in code and TipTap editors. |
| `Ctrl+Y` / `Ctrl+Shift+Z` | **Redo** | Re-applies reverted typing/formatting. |
| `Ctrl+L` | **Chat / Selection to AI** | **With selection:** sends mention chip (`@filename#L36-43`) to AI chat and focuses composer.<br>**Without selection:** toggles AI panel open/closed without stealing focus. |
| `Ctrl+B` | **Toggle Left Sidebar** | Toggles file explorer sidebar, collapsing to the rail. |
| `Ctrl+S` / `Cmd+S` | **Save File** | Saves active code document or TipTap markdown document. |
| `F2` | **Rename File** | Inline renaming in the File Explorer. |
| `Escape` | **Dismiss Modal** | Closes Command Palette, Quick Open, Find Widget, or Dialogs. |

---

### 6. 🖱️ Smart Right-Click Context Menus
- **File Explorer Row Context Menu**:
  - `📄 Open File`: Opens file in a new tab.
  - `📄 New File...` / `📁 New Folder...`: Directory-aware creation (right-clicking a subfolder targets that directory as parent).
  - `✏️ Rename (F2)`: Rename file/folder.
  - `🗑️ Move to Trash`: Safely move file/folder to OS Recycle Bin / Trash with sleek confirmation.
  - `📋 Copy Path` & `📋 Copy Relative Path`: Copies absolute or workspace-relative path to clipboard.
  - *No "Ask AI about this file" entry, on purpose*: the composer's own `@` menu does that where you are already typing.

---

## 🚀 Quickstart & Installation Guide

### Option 1: 1-Click Install Script (Linux / macOS)

```bash
git clone https://github.com/minhdevtry/deepseek-harness-plugins.git
cd deepseek-harness-plugins

# Run 1-click installer
./install.sh

# Start DeepSeek Harness
dsh web
```

---

### Option 2: Universal NPM Setup (Windows, macOS, Linux)

```bash
git clone https://github.com/minhdevtry/deepseek-harness-plugins.git
cd deepseek-harness-plugins

# Install, build, and deploy in one command:
npm run setup

# Start DeepSeek Harness
dsh web
```

---

### Option 3: Step-by-Step Manual Setup

1. **Install Dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Build TipTap Bundle & Unified Layout**:
   ```bash
   npm run build
   ```

3. **Deploy Plugins to Profile**:
   ```bash
   npm run deploy
   ```
   *This automatically registers `@anoslide/dsh-client-vscode-layout` and `@anoslide/dsh-host-files` into `~/.dsh/profiles/web/` and updates `cordis.patch.yml`.*

4. **Launch DeepSeek Harness**:
   ```bash
   dsh web
   ```
   Open `http://127.0.0.1:3080` in your browser.

---

## 🧪 Automated Testing

Run the full end-to-end Playwright test suite (14 automated steps):

```bash
npm test
```

---

## 📂 Repository Architecture

```text
deepseek-harness-plugins/
├── install.sh                          # 1-Click automated installer for Linux/macOS
├── package.json                        # Scripts & dependencies
├── build-tiptap.mjs                    # Rollup compiler for standalone TipTap 3 suite
├── build-unified-vscode-layout.mjs     # Compiler for 3-Column VS Code Layout
├── deploy-vscode-notion-layout.mjs     # Installer into ~/.dsh/profiles/web
├── plugins/
│   ├── dsh-client-vscode-layout/       # Browser frontend plugin (React + Shiki + TipTap)
│   │   ├── assets/                     # Bundled assets (tiptap.bundle.js, file icons)
│   │   ├── lib/                        # Generated client bundle
│   │   └── package.json
│   ├── dsh-host-files/                 # Node.js backend plugin (file endpoints, search, git, trash)
│   │   ├── lib/index.js
│   │   └── package.json
│   ├── dsh-at-file/                    # @file mention autocomplete plugin
│   └── dsh-task-board/                 # Kanban Task Board UI plugin
└── tests/
    └── e2e.test.mjs                    # Comprehensive Playwright end-to-end test suite
```

---

## 📄 License

MIT © [minhdevtry](https://github.com/minhdevtry)
