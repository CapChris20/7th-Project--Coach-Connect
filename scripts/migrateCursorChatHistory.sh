#!/bin/bash
# Migrate Cursor chat history from the old renamed workspace to the current folder.
# Old: 7th Project- Coach Connect Mobile App  (workspace 6e26d665...)
# New: 7th-Project--Coach-Connect            (workspace 30fac3e2...)
#
# Usage:
#   1. Quit Cursor completely (Cmd+Q)
#   2. bash scripts/migrateCursorChatHistory.sh
#   3. Reopen: open -a "Cursor 2" "/Users/captainchris20/Desktop/My-Coding-Portfolio/7th-Project--Coach-Connect"

set -euo pipefail

OLD_WS_ID="6e26d665dc6e7bd5f3eafd88fdb29e94"
NEW_WS_ID="30fac3e2e152cffaa2b30c56f05d7252"
OLD_PATH_FRAGMENT="7th Project- Coach Connect Mobile App"
NEW_PATH_FRAGMENT="7th-Project--Coach-Connect"
OLD_PATH_ENCODED="7th%20Project-%20Coach%20Connect%20Mobile%20App"
NEW_PATH_ENCODED="7th-Project--Coach-Connect"

CURSOR_SUPPORT="$HOME/Library/Application Support/Cursor/User"
OLD_WS="$CURSOR_SUPPORT/workspaceStorage/$OLD_WS_ID"
NEW_WS="$CURSOR_SUPPORT/workspaceStorage/$NEW_WS_ID"
GLOBAL_DB="$CURSOR_SUPPORT/globalStorage/state.vscdb"
BACKUP_DIR="$HOME/Desktop/cursor-chat-migration-backup-$(date +%Y%m%d-%H%M%S)"

if pgrep -f "Cursor 2" >/dev/null 2>&1 || pgrep -f "Cursor Helper" >/dev/null 2>&1; then
  echo "ERROR: Cursor is still running. Quit with Cmd+Q first, then run this again."
  exit 1
fi

if [[ ! -d "$OLD_WS" ]]; then
  echo "ERROR: Old workspace storage not found: $OLD_WS"
  exit 1
fi

if [[ ! -d "$NEW_WS" ]]; then
  echo "ERROR: New workspace storage not found: $NEW_WS"
  echo "Open the project once in Cursor, quit, then run this script."
  exit 1
fi

echo "Backing up to $BACKUP_DIR ..."
mkdir -p "$BACKUP_DIR"
cp -a "$OLD_WS" "$BACKUP_DIR/old-workspace"
cp -a "$NEW_WS" "$BACKUP_DIR/new-workspace"
cp -a "$GLOBAL_DB" "$BACKUP_DIR/global-state.vscdb" 2>/dev/null || true
cp -a "$GLOBAL_DB-wal" "$BACKUP_DIR/global-state.vscdb-wal" 2>/dev/null || true
cp -a "$GLOBAL_DB-shm" "$BACKUP_DIR/global-state.vscdb-shm" 2>/dev/null || true

echo "Copying old workspace chat database into new workspace ..."
cp -a "$OLD_WS/state.vscdb" "$NEW_WS/state.vscdb"
rm -f "$NEW_WS/state.vscdb-wal" "$NEW_WS/state.vscdb-shm"

echo "Updating global composer headers (old path -> new path) ..."
python3 << 'PY'
import json
import sqlite3
from pathlib import Path

global_db = Path.home() / "Library/Application Support/Cursor/User/globalStorage/state.vscdb"
old_id = "6e26d665dc6e7bd5f3eafd88fdb29e94"
new_id = "30fac3e2e152cffaa2b30c56f05d7252"
replacements = [
    (old_id, new_id),
    ("7th Project- Coach Connect Mobile App", "7th-Project--Coach-Connect"),
    ("7th%20Project-%20Coach%20Connect%20Mobile%20App", "7th-Project--Coach-Connect"),
]

conn = sqlite3.connect(global_db)
cur = conn.cursor()
cur.execute("SELECT value FROM ItemTable WHERE key='composer.composerHeaders'")
row = cur.fetchone()
if row:
    raw = row[0]
    updated = raw
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != raw:
        cur.execute(
            "UPDATE ItemTable SET value=? WHERE key='composer.composerHeaders'",
            (updated,),
        )
        print("  composer.composerHeaders updated")
    else:
        print("  composer.composerHeaders unchanged (no matching tags)")
else:
    print("  composer.composerHeaders not found (skipped)")

conn.commit()
conn.close()
PY

echo ""
echo "Done. Backup saved at:"
echo "  $BACKUP_DIR"
echo ""
echo "Now open Cursor with:"
echo '  open -a "Cursor 2" "/Users/captainchris20/Desktop/My-Coding-Portfolio/7th-Project--Coach-Connect"'
echo ""
echo "Then Cmd+I -> history/clock icon. Old chats should appear in THIS folder."
