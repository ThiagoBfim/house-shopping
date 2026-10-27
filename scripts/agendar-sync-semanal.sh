#!/bin/sh
# Agenda o /sync-semanal toda segunda às 18h: abre o Chrome e um Terminal com o Claude Code no projeto.
# Uso: sh scripts/agendar-sync-semanal.sh [remover | mostrar]
set -eu

LABEL=com.house-shopping.sync-semanal
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR=$(cd "$(dirname "$0")/.." && pwd)
CLAUDE=$(command -v claude || echo "$HOME/.local/bin/claude")

plist() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/osascript</string>
    <string>-e</string>
    <string>tell application "Google Chrome" to activate</string>
    <string>-e</string>
    <string>tell application "Terminal" to do script "cd '$DIR' &amp;&amp; '$CLAUDE' '/sync-semanal'"</string>
    <string>-e</string>
    <string>tell application "Terminal" to activate</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>1</integer>
    <key>Hour</key>
    <integer>18</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
</dict>
</plist>
EOF
}

case "${1:-}" in
  mostrar)
    plist
    ;;
  remover)
    launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✔ Agendamento removido."
    ;;
  *)
    mkdir -p "$(dirname "$PLIST")"
    plist > "$PLIST"
    launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "✔ /sync-semanal agendado para toda segunda às 18h ($PLIST)."
    echo "  Testar agora: launchctl kickstart gui/$(id -u)/$LABEL"
    ;;
esac
