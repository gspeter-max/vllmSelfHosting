#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   vLLM Self-Hosting: Universal Start   ${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. Detect Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker Desktop or Docker Engine first."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running.${NC}"
    echo "Please start Docker Desktop or the docker service."
    exit 1
fi

# 2. Detect OS & Hardware
OS="$(uname -s)"
ARCH="$(uname -m)"
COMPOSE_FILES="-f docker-compose.yml"
MODE="cpu"

echo -e "${BLUE}Detecting hardware...${NC}"

if [[ "$OS" == "Darwin" ]]; then
    # macOS
    echo -e "  OS: ${GREEN}macOS ($ARCH)${NC}"
    if [[ "$ARCH" == "arm64" ]]; then
        echo -e "  GPU: ${GREEN}Apple Silicon (Metal)${NC}"
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.mac.yml"
        MODE="mac-gpu"
    else
        echo -e "  GPU: ${YELLOW}Intel (No Metal acceleration in Docker)${NC}"
        # Intel Macs act like standard CPU
    fi

elif [[ "$OS" == "Linux" ]]; then
    echo -e "  OS: ${GREEN}Linux ($ARCH)${NC}"
    
    if command -v nvidia-smi &> /dev/null; then
        echo -e "  GPU: ${GREEN}NVIDIA Detected${NC}"
        COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.nvidia.yml"
        MODE="nvidia-gpu"
    elif [[ -e /dev/kfd ]]; then
        echo -e "  GPU: ${YELLOW}AMD ROCm Detected (Experimental)${NC}"
        # For now, we don't have a specific AMD compose file in the plan, falls back to CPU or could add later
        echo "  Note: AMD support requires manual config currently. Using CPU mode."
    else
        echo -e "  GPU: ${YELLOW}None detected (CPU Mode)${NC}"
    fi
else
    echo -e "  OS: ${YELLOW}$OS (Unknown)${NC}"
    echo "  Defaulting to CPU mode."
fi

# 3. Create .env if missing
if [[ ! -f .env ]]; then
    echo -e "\n${YELLOW}Creating .env file from defaults...${NC}"
    echo "PORT=3000" > .env
    echo "OLLAMA_PORT=11434" >> .env
fi

# 4. Launch
echo -e "\n${BLUE}Starting services in ${GREEN}${MODE}${BLUE} mode...${NC}"
echo -e "Command: docker compose $COMPOSE_FILES up -d --remove-orphans"

docker compose $COMPOSE_FILES up -d --remove-orphans

echo -e "\n${GREEN}✅ Services started!${NC}"
echo -e "  App:    http://localhost:3000"
echo -e "  Ollama: http://localhost:11434"
echo -e "\n${BLUE}Logs:${NC} docker compose logs -f"
