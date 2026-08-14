# `dsh-task-board` (Kanban) Plugin Guide & English Patch

This folder contains setup instructions and English localization patches for the **Task Board / Multi-Column Kanban Plugin** (`@linxin666/dsh-client-ui-task-board`).

## 📌 NPM Package
* Package: [`@linxin666/dsh-client-ui-task-board`](https://www.npmjs.com/package/@linxin666/dsh-client-ui-task-board)

## 💡 Functionality
* Adds a sidebar entry and multi-column **Kanban view** with local persistence.
* Supports task details, task management, and execution through `dsh` sessions.

## 🚀 Installation & Patching

### 1. Install Plugin
```bash
dsh plugin --profile web add @linxin666/dsh-client-ui-task-board
```

### 2. Apply English UI Localization Patch
```bash
node plugins/dsh-task-board/patch.js
```
