#!/bin/bash
# ============================================================
# setup.sh — One-command setup for the LLM Dashboard
# Usage: ./setup.sh
# ============================================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BOLD}🚀 LLM Dashboard Setup${NC}"
echo "=============================="
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed.${NC}"
    echo "  Please install Node.js v18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js v18+ is required. You have v$(node -v).${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# 2. Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v) detected${NC}"

# 3. Install frontend dependencies
echo ""
echo -e "${BOLD}📦 Installing dependencies...${NC}"
cd "$(dirname "$0")/frontend"
npm install

# 4. Start dev server
echo ""
echo -e "${GREEN}=============================${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo -e "${GREEN}=============================${NC}"
echo ""
echo -e "${BOLD}Starting dashboard...${NC}"
echo -e "Dashboard will be available at: ${YELLOW}http://localhost:3000${NC}"
echo ""
npm run dev
