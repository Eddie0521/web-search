#!/usr/bin/env bash
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"

for DEST in "$HOME/.claude/skills/web-search" "$HOME/.agents/skills/web-search"; do
  mkdir -p "$DEST/lib"
  cp "$SRC/SKILL.md" "$SRC/search.ts" "$SRC/fetch.ts" "$DEST/"
  cp "$SRC/lib/"*.ts "$DEST/lib/"
  echo "✓ $DEST"
done
