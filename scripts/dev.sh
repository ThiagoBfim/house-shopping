#!/usr/bin/env bash
# Sobe o site em modo dev em http://localhost:5174/house-shopping/
# Uso: ./scripts/dev.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Node 24 pelo fnm (o node do Homebrew está quebrado nesta máquina).
eval "$(fnm env)"
fnm use --install-if-missing >/dev/null

# Instala as dependências na primeira vez ou quando o package-lock mudar.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install
fi

exec npx vite --port 5174 --strictPort --open
