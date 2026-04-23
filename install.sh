#!/bin/bash
# bonsai.js — npm migration shim (v2.5.8+)
# legacy users on ≤v2.5.7 hit this when they run `bon update`. we just
# forward to npm. new users should run `npm i -g @dexcodesxs/bon` directly.

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${GREEN}  ◆  bonsai.js installer${RESET}  ${DIM}(v2.5.8+ → npm)${RESET}"
echo ""

# need node + npm
if ! command -v npm >/dev/null 2>&1; then
  echo -e "  ${RED}✗${RESET}  npm not found. install Node.js first:"
  echo ""
  if [ -n "$TERMUX_VERSION" ]; then
    echo -e "    ${CYAN}pkg install nodejs${RESET}"
  elif [ "$(uname)" = "Darwin" ]; then
    echo -e "    ${CYAN}brew install node${RESET}"
  else
    echo -e "    ${CYAN}sudo apt install nodejs npm${RESET}     ${DIM}# debian/ubuntu${RESET}"
    echo -e "    ${CYAN}sudo dnf install nodejs npm${RESET}     ${DIM}# fedora${RESET}"
    echo -e "    ${CYAN}https://nodejs.org${RESET}              ${DIM}# manual${RESET}"
  fi
  echo ""
  echo -e "  ${DIM}then re-run this installer.${RESET}"
  exit 1
fi

NODE_VER=$(node -v 2>/dev/null || echo "unknown")
NPM_VER=$(npm -v 2>/dev/null || echo "unknown")
echo -e "  ${GREEN}●${RESET}  node $NODE_VER · npm $NPM_VER"
echo ""

echo -e "  ${DIM}running:${RESET} ${CYAN}npm i -g @dexcodesxs/bon${RESET}"
echo ""

# try without sudo first; fall back to sudo if EACCES on global install
if npm i -g @dexcodesxs/bon 2>&1; then
  :
else
  EXIT=$?
  if [ $EXIT -ne 0 ]; then
    echo ""
    echo -e "  ${YELLOW}!${RESET}  npm install failed. trying with sudo..."
    sudo npm i -g @dexcodesxs/bon || {
      echo -e "  ${RED}✗${RESET}  install failed. try fixing npm permissions:"
      echo -e "      ${CYAN}https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally${RESET}"
      exit 1
    }
  fi
fi

echo ""
echo -e "  ${GREEN}✓${RESET}  ${GREEN}installed!${RESET}"
echo ""
echo -e "  ${DIM}verify:${RESET}  ${CYAN}bon --version${RESET}"
echo -e "  ${DIM}quickstart:${RESET}  ${CYAN}bon login && bon ui${RESET}"
echo ""

# legacy users w/ old wrapper still in PATH — point them at it
if [ -f "$HOME/.bonsai-oss/bonsai.js" ]; then
  echo -e "  ${DIM}migration tip: remove the old wrapper to avoid PATH conflicts:${RESET}"
  echo -e "    ${CYAN}rm -rf ~/.bonsai-oss/bin ~/.bonsai-oss/bonsai.js ~/.bonsai-oss/api.js${RESET}"
  echo ""
fi
