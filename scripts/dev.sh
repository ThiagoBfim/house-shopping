#!/usr/bin/env bash
# Sobe o site em modo dev em http://localhost:5174/house-shopping/ e o backend local da
# 2ª wave (npm run server, http://127.0.0.1:8787), que liga os "Recursos em teste".
# Uso: ./scripts/dev.sh              site + backend
#      ./scripts/dev.sh --no-backend  só o site, sem o backend e sem os recursos em teste
set -euo pipefail

cd "$(dirname "$0")/.."

BACKEND=1
for arg in "$@"; do
  case "$arg" in
    --no-backend) BACKEND=0 ;;
    *)
      echo "Opção desconhecida: $arg (use --no-backend)" >&2
      exit 1
      ;;
  esac
done

# Node 24 pelo fnm (o node do Homebrew está quebrado nesta máquina).
eval "$(fnm env)"
fnm use --install-if-missing >/dev/null

# Instala as dependências na primeira vez ou quando o package-lock mudar.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install
fi

PIDS=()
# Ctrl+C, erro ou fim: o que este script subiu sai junto.
cleanup() {
  trap - EXIT INT TERM
  [ ${#PIDS[@]} -gt 0 ] && kill "${PIDS[@]}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [ "$BACKEND" = 0 ]; then
  # Endereço vazio: o site nem procura o backend (painel "Recursos em teste" escondido).
  export VITE_LOCAL_API=
  echo "Sem backend local: recursos em teste desligados."
elif curl -s -o /dev/null --max-time 1 http://127.0.0.1:8787/api/health; then
  echo "Backend local já está rodando em http://127.0.0.1:8787 (usando o que existe)."
else
  command -v claude >/dev/null || echo "Aviso: 'claude' não encontrado no PATH; planta e preços vão falhar."
  node server/index.ts &
  PIDS+=($!)
fi

# vite direto (sem npx): parar este processo para o site de verdade.
node_modules/.bin/vite --port 5174 --strictPort --open &
SITE=$!
PIDS+=("$SITE")
wait "$SITE"
