#!/bin/bash

# ╔══════════════════════════════════════════╗
# ║        BONSAI.JS INSTALLER               ║
# ║   Linux / macOS / Termux / WSL           ║
# ╚══════════════════════════════════════════╝

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

REPO="DexCodeSX/Secret"
RAW_URL="https://raw.githubusercontent.com/$REPO/main"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║         ${BOLD}BONSAI.JS INSTALLER${RESET}${GREEN}              ║${RESET}"
echo -e "${GREEN}║    Reverse Engineered Bonsai CLI         ║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${RESET}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "  ${RED}[!] Node.js not found${RESET}"
    echo ""
    if [ -n "$TERMUX_VERSION" ]; then
        echo -e "  ${CYAN}Run: pkg install nodejs${RESET}"
    elif [ "$(uname)" = "Darwin" ]; then
        echo -e "  ${CYAN}Run: brew install node${RESET}"
    else
        echo -e "  ${CYAN}Run: sudo apt install nodejs npm${RESET}"
        echo -e "  ${DIM}Or visit: https://nodejs.org${RESET}"
    fi
    exit 1
fi

NODE_VER=$(node -v)
echo -e "  ${GREEN}[OK]${RESET} Node.js $NODE_VER"

# Check npx
if ! command -v npx &> /dev/null; then
    echo -e "  ${YELLOW}[!] npx not found, installing...${RESET}"
    if [ -n "$TERMUX_VERSION" ]; then
        pkg install nodejs -y
    else
        npm install -g npx 2>/dev/null || true
    fi
fi

# Install directory
if [ -n "$TERMUX_VERSION" ]; then
    INSTALL_DIR="$HOME/.bonsai-oss"
    BIN_DIR="$PREFIX/bin"
else
    INSTALL_DIR="$HOME/.bonsai-oss"
    BIN_DIR="$HOME/.local/bin"
fi

mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Download bonsai.js
echo ""
echo -e "  ${DIM}Downloading bonsai.js...${RESET}"

if command -v curl &> /dev/null; then
    curl -sL "$RAW_URL/bonsai.js" -o "$INSTALL_DIR/bonsai.js"
elif command -v wget &> /dev/null; then
    wget -q "$RAW_URL/bonsai.js" -O "$INSTALL_DIR/bonsai.js"
else
    echo -e "  ${RED}[!] Neither curl nor wget found${RESET}"
    exit 1
fi

echo -e "  ${GREEN}[OK]${RESET} Downloaded to $INSTALL_DIR/bonsai.js"

# Download api.js
echo -e "  ${DIM}Downloading api.js...${RESET}"
if command -v curl &> /dev/null; then
    curl -sL "$RAW_URL/api.js" -o "$INSTALL_DIR/api.js" 2>/dev/null || true
elif command -v wget &> /dev/null; then
    wget -q "$RAW_URL/api.js" -O "$INSTALL_DIR/api.js" 2>/dev/null || true
fi
if [ -f "$INSTALL_DIR/api.js" ]; then
    echo -e "  ${GREEN}[OK]${RESET} Downloaded to $INSTALL_DIR/api.js"
fi

# Create bon wrapper script
cat > "$BIN_DIR/bon" << 'WRAPPER'
#!/bin/bash
node "$HOME/.bonsai-oss/bonsai.js" "$@"
WRAPPER

chmod +x "$BIN_DIR/bon"
echo -e "  ${GREEN}[OK]${RESET} Created ${CYAN}bon${RESET} command"

# Add to PATH if needed
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    SHELL_RC=""
    if [ -n "$TERMUX_VERSION" ]; then
        SHELL_RC="$HOME/.bashrc"
    elif [ -f "$HOME/.zshrc" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        SHELL_RC="$HOME/.bashrc"
    fi

    if [ -n "$SHELL_RC" ]; then
        echo "" >> "$SHELL_RC"
        echo "# Bonsai.js" >> "$SHELL_RC"
        echo "export PATH=\"\$PATH:$BIN_DIR\"" >> "$SHELL_RC"
        echo -e "  ${GREEN}[OK]${RESET} Added to PATH in $SHELL_RC"
    fi
    export PATH="$PATH:$BIN_DIR"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}║       ${BOLD}INSTALLATION COMPLETE!${RESET}${GREEN}             ║${RESET}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${RESET}"
echo -e "${GREEN}║${RESET}                                          ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}   Usage:  ${CYAN}bon --help${RESET}                     ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}           ${CYAN}bon login${RESET}                      ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}           ${CYAN}bon start${RESET}                      ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}           ${CYAN}bon start --resume${RESET}             ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}                                          ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}   ${DIM}Restart terminal if 'bon' not found${RESET}    ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}   ${DIM}GitHub: github.com/$REPO${RESET}   ${GREEN}║${RESET}"
echo -e "${GREEN}║${RESET}                                          ${GREEN}║${RESET}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${RESET}"
echo ""
