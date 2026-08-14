# DeepSeek Harness Plugins & Patches Repository (`deepseek-harness-plugins`)

A organized multi-plugin repository for **DeepSeek Harness (`dsh`)** containing plugin guides, setup scripts, and localization patches.

## 📂 Repository Structure

```text
deepseek-harness-plugins/
├── README.md
├── apply-config.js                  # Master setup script for all plugins & patches
├── cordis.patch.yml                 # Base profile patch configuration
└── plugins/                         # Collection of individual plugins
    └── dsh-local-filetree/          # Local File Tree Explorer plugin guide & patches
        ├── README.md                # Installation & patch instructions
        └── patch.js                 # English UI localization patch script
```

## 🔌 Managed Plugins

* 🌳 **[`plugins/dsh-local-filetree`](plugins/dsh-local-filetree)**: File Tree Explorer plugin (Upstream: `github:Mongfayi/dsh-local-filetree`), localized to **100% English**.
* 🛠️ **Enabled Built-in Tools**:
  * `tool-bash`, `tool-fs`, `tool-fs-search`, `tool-str-replace-editor`
  * `tool-todo`, `tool-web`, `tool-skill`, `plan-mode`, `command-compact`
  * `compaction-basic`, `tool-result-pruner`, `subagent-fork-in-process`

## 🚀 Quickstart & Setup Guide

To apply all plugin installations and localization patches:

```bash
# 1. Run master setup script
node apply-config.js

# 2. Launch dsh web
dsh web
```

To run a specific plugin patch:
```bash
node plugins/dsh-local-filetree/patch.js
```

---
*Author: [minhdevtry](https://github.com/minhdevtry)*
