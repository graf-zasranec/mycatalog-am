#!/bin/bash
# Turns the Mac crawler on, only if every shop answers from an Armenian IP. Undo: --off
set -eu
L=~/Library/LaunchAgents/am.better.refresh.plist
if [ "${1:-}" = --off ]; then launchctl bootout "gui/$(id -u)/am.better.refresh" 2>/dev/null || true; rm -f "$L"; gh variable delete MAC_CRAWLER_AT --repo graf-zasranec/mycatalog-am 2>/dev/null || true; echo "Mac crawler off."; exit 0; fi
cd "$(dirname "$0")/.."
node tools/shop-reach.mjs --require || { echo "Not turned on: fix the refusals above first."; exit 1; }
J="$HOME/Movies/Claude code/better-jobs"; mkdir -p "$J"; cp tools/mac-refresh.sh "$J/mac-refresh.sh"
# Ten minutes before GitHub's 00:00 and 11:00 Yerevan runs, so the Mac claims the slot first.
cat > "$L" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>am.better.refresh</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>$J/mac-refresh.sh</string></array>
<key>StartCalendarInterval</key><array>
<dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>50</integer></dict>
<dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>50</integer></dict>
</array></dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$L"
echo "Mac crawler on: 23:50 and 10:50 Mac time."
