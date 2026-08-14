# DeepSeek Harness Plugins & Patches (`deepseek-harness-plugins`)

Centralized configuration, English UI localizations, and automated setup scripts for **DeepSeek Harness (`dsh`)**.

## 📌 Features & Configurations
* 🌳 **`dsh-local-filetree`**: File Tree Explorer plugin localized to **100% English**.
* 🛠️ **Enabled Built-in Tools (`disabled: false`)**:
  * `tool-bash`, `tool-fs`, `tool-fs-search`
  * `tool-str-replace-editor` (Precise code editing with UI Diff view)
  * `tool-todo`, `tool-web`, `tool-skill`
  * `plan-mode` & `command-compact`
  * `compaction-basic` & `tool-result-pruner` (Context compaction services)
  * `subagent-fork-in-process` & `tool-subagent` (Subagent process forking)

## 🚀 Quickstart & Setup Guide

When setting up a new environment or after updating `dsh`, clone this repository and run:

```bash
# 1. Automatically apply profile patches & English localizations
node apply-config.js

# 2. Launch dsh web
dsh web
```

### 🌐 Run English Localization Patch Only
```bash
node patch-en.js
```

---
*Author: [minhdevtry](https://github.com/minhdevtry)*
