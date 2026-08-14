# `dsh-local-filetree` Plugin Guide & Localization Patch

This folder contains setup instructions and localization patches for the **File Tree Explorer Plugin** (`dsh-local-filetree`).

## 📌 Upstream Repository
* Original Repository: [`github:Mongfayi/dsh-local-filetree`](https://github.com/Mongfayi/dsh-local-filetree)

## 🚀 Installation & Patching

### 1. Install Upstream Plugin
```bash
dsh plugin --profile web add github:Mongfayi/dsh-local-filetree
```

### 2. Apply English UI Localization Patch
Run the patch script to convert Chinese UI labels to English:
```bash
node plugins/dsh-local-filetree/patch.js
```
