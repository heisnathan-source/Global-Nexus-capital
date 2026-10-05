#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: ./apply-points-mall-restore.sh /path/to/railway-repo"
  exit 1
fi

REPO="$(cd "$1" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -d "$REPO/app" ] || { echo "ERROR: $REPO/app not found"; exit 1; }
[ -f "$REPO/app/globals.css" ] || { echo "ERROR: $REPO/app/globals.css not found"; exit 1; }

mkdir -p "$REPO/app/points-mall"

TARGET="$REPO/app/points-mall/page.jsx"
if [ -f "$TARGET" ]; then
  cp "$TARGET" "$TARGET.backup-before-points-mall-restore"
  echo "Backed up $TARGET"
fi
cp "$HERE/app/points-mall/page.jsx" "$TARGET"

CSS="$REPO/app/globals.css"
MARKER="/* POINTS MALL RESTORE - two-column shop */"
if ! grep -qF "$MARKER" "$CSS"; then
  cat "$HERE/points-mall.css" >> "$CSS"
  echo "Added Points Mall CSS"
else
  echo "Points Mall CSS already present; left it unchanged"
fi

echo "Restored Points Mall in: $REPO"
echo "Next: npm run build"
