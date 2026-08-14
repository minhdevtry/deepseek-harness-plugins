#!/usr/bin/env bash
set -e

echo "=================================================================="
echo "  DeepSeek Harness Plugins - 3-Column VS Code & TipTap Suite Installer"
echo "=================================================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[!] Node.js is not installed. Please install Node.js (v18+) first."
    exit 1
fi

echo "[1/4] Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install --ignore-scripts
else
    npm install --legacy-peer-deps
fi

echo "[2/4] Building TipTap Bundle & Unified VS Code Layout..."
node build-tiptap.mjs
node build-unified-vscode-layout.mjs

echo "[3/4] Deploying to DeepSeek Harness Profile (~/.dsh/profiles/web)..."
node deploy-vscode-notion-layout.mjs

echo "[4/4] Verifying installation..."
echo ""
echo "=================================================================="
echo "  [✓] Installation & Deployment Completed Successfully!"
echo "=================================================================="
echo ""
echo "To start DeepSeek Harness with the new layout, run:"
echo "  dsh web"
echo ""
