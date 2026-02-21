#!/bin/bash
set -e

SOPHON_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_WORKSPACE="${HOME}/.openclaw/workspace"
OPENCLAW_EXTENSIONS="${HOME}/.openclaw/extensions"
SOPHON_DATA="${HOME}/.sophon"

echo "=== Sophon Installer ==="

# Check OpenClaw is installed
if ! command -v openclaw &> /dev/null; then
  echo "Error: OpenClaw is not installed. Run: curl -fsSL https://get.openclaw.ai | bash"
  exit 1
fi

# Create data directory
mkdir -p "$SOPHON_DATA"
echo "Created data directory: $SOPHON_DATA"

# Install plugin
mkdir -p "$OPENCLAW_EXTENSIONS/sophon"
cd "$SOPHON_DIR/plugin"
npm install
cp -r src/ "$OPENCLAW_EXTENSIONS/sophon/src/"
cp openclaw.plugin.json "$OPENCLAW_EXTENSIONS/sophon/"
cp package.json "$OPENCLAW_EXTENSIONS/sophon/"
cp tsconfig.json "$OPENCLAW_EXTENSIONS/sophon/"
cp -r node_modules/ "$OPENCLAW_EXTENSIONS/sophon/node_modules/"
echo "Installed plugin to: $OPENCLAW_EXTENSIONS/sophon"

# Copy workspace files (backup existing first)
for file in SOUL.md AGENTS.md IDENTITY.md USER.md; do
  if [ -f "$OPENCLAW_WORKSPACE/$file" ]; then
    cp "$OPENCLAW_WORKSPACE/$file" "$OPENCLAW_WORKSPACE/${file}.backup"
    echo "Backed up existing $file"
  fi
  cp "$SOPHON_DIR/workspace/$file" "$OPENCLAW_WORKSPACE/$file"
done
echo "Installed workspace files"

echo ""
echo "=== Sophon installed successfully ==="
echo "Data stored at: $SOPHON_DATA"
echo "Start with: openclaw"
