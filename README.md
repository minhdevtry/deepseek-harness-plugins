# DeepSeek Harness Plugins & Patches Repository (`deepseek-harness-plugins`)

A organized multi-plugin repository for **DeepSeek Harness (`dsh`)** containing plugin guides, setup scripts, and feature & localization patches.

## 📂 Repository Structure

```text
deepseek-harness-plugins/
├── README.md
├── apply-config.js                  # Master setup script for all plugins & patches
├── cordis.patch.yml                 # Base profile patch configuration
└── plugins/                         # Collection of individual plugins
    ├── dsh-local-filetree/          # File Tree Explorer & BlockNote Markdown Editor
    │   ├── README.md                # Installation & patch instructions
    │   └── patch.js                 # Editor & localization patch script
    ├── dsh-at-file/                 # @file mention autocomplete plugin guide
    │   └── README.md                # Installation & feature instructions
    └── dsh-task-board/              # Kanban Task Board UI plugin guide
        ├── README.md                # Installation & feature instructions
        └── patch.js                 # Layout & English localization patch
```

## 🔌 Managed Plugins

* 🌳 **[`plugins/dsh-local-filetree`](plugins/dsh-local-filetree)**: File Tree Explorer + **Interactive Code Editor & BlockNote-Style Markdown Editor** (Upstream: `github:Mongfayi/dsh-local-filetree`).
* 📎 **[`plugins/dsh-at-file`](plugins/dsh-at-file)**: `@file` Mention Autocomplete plugin (Upstream: `github:omdsh-dev/dsh-at-file`) for mentioning & attaching workspace files directly in chat.
* 📋 **[`plugins/dsh-task-board`](plugins/dsh-task-board)**: Multi-column Kanban Task Board plugin (Package: `@linxin666/dsh-client-ui-task-board`) for tracking task progress visually in the Web UI.
* 🛠️ **Enabled Built-in Tools**:
  * `tool-bash`, `tool-fs`, `tool-fs-search`, `tool-str-replace-editor`
  * `tool-todo`, `tool-web`, `tool-skill`, `plan-mode`, `command-compact`
  * `compaction-basic`, `tool-result-pruner`, `subagent-fork-in-process`

## 🚀 Quickstart & Setup Guide

To apply all plugin installations and patches on any machine:

```bash
# 1. Run master setup script
node apply-config.js

# 2. Launch dsh web
dsh web
```

To run a specific plugin patch:
```bash
node plugins/dsh-local-filetree/patch.js
node plugins/dsh-task-board/patch.js
```

---
*Author: [minhdevtry](https://github.com/minhdevtry)*
