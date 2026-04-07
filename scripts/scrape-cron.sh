#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ammar/quran-app"
LOG_FILE="$REPO_DIR/logs/scrape-translation-of-abu-iyaad.log"
LOCK_FILE="$REPO_DIR/logs/scrape-translation-of-abu-iyaad.lock"

mkdir -p "$(dirname "$LOG_FILE")"

cd "$REPO_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Check if a previous scrape is still running
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    log "Previous scrape (PID $OLD_PID) still running. Skipping."
    exit 0
  fi
  log "Stale lock file found (PID $OLD_PID no longer running). Removing."
  rm -f "$LOCK_FILE"
fi

# Write lock
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

log "Starting scrape of translation of Abu Iyaad..."

if ! bun scripts/scrape-translation-of-abu-iyaad.ts >> "$LOG_FILE" 2>&1; then
  log "Scrape failed (exit $?). Skipping push."
  exit 1
fi

log "Scrape complete. Checking for changes..."

if git diff --quiet public/data/abu-iyaad.json public/data/abu-iyaad-notes.json public/data/abu-iyaad-surahs.json 2>/dev/null; then
  log "No changes detected, skipping push."
else
  log "Changes detected, committing and pushing..."
  git add public/data/abu-iyaad.json public/data/abu-iyaad-notes.json public/data/abu-iyaad-surahs.json
  git commit -m "Update Abu Iyaad translations and notes data (auto-scrape)"
  git push
  log "Pushed to remote."
fi

log "Done."
