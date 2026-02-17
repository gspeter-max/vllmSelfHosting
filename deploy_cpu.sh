#!/bin/bash
set -e

################################################################################
# deploy_cpu.sh - Smart CPU Model Deployment via Ollama
#
# Usage: ./deploy_cpu.sh <huggingface-repo> [--background]
#
# Examples:
#   ./deploy_cpu.sh meta-llama/Llama-3.2-3B-Instruct
#   ./deploy_cpu.sh Qwen/Qwen2.5-7B-Instruct --background
#   ./deploy_cpu.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0
#
# Auto-detects your system (OS, CPU, RAM), picks the best GGUF quantization,
# warns about heavy models, and deploys via Ollama.
#
# Supports: macOS (Apple Silicon + Intel), Linux, Windows (WSL)
################################################################################

# ═══════════════════════════════════════════════════════════════════════════════
# Section 1: Colors & Constants
# ═══════════════════════════════════════════════════════════════════════════════

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

OLLAMA_HOST="http://localhost:11434"
OVERHEAD_GB=1.0

# GGUF quantization: GB per billion parameters
# Order: lowest quality → highest quality
declare -a QUANT_NAMES=("Q2_K" "Q3_K_M" "Q4_K_M" "Q5_K_M" "Q6_K" "Q8_0")
declare -a QUANT_RATES=("0.40" "0.50" "0.60" "0.75" "0.85" "1.10")
declare -a QUANT_QUALITY=("Low" "Medium-Low" "Medium ★" "Medium-High" "High" "Highest")

# Hardcoded model-name → param-count fallbacks (for names that don't contain xB)
# Using a function instead of associative array for bash 3.x compatibility (macOS default)
lookup_known_model() {
    local name_lower="$1"
    case "$name_lower" in
        *tinyllama*)     echo "1.1"  ;;
        *phi-3-mini*)    echo "3.8"  ;;
        *phi-3-small*)   echo "7.0"  ;;
        *phi-3-medium*)  echo "14.0" ;;
        *phi-2*)         echo "2.7"  ;;
        *phi-1.5*)       echo "1.3"  ;;
        *gemma-2b*)      echo "2.0"  ;;
        *gemma-7b*)      echo "7.0"  ;;
        *mixtral*)       echo "47.0" ;;
        *mistral*)       echo "7.0"  ;;
        *smollm*)        echo "0.135";;
        *stablelm-2*)    echo "1.6"  ;;
        *codellama*)     echo "7.0"  ;;
        *deepseek-coder*) echo "6.7" ;;
        *)               echo ""     ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 2: Usage & Input Parsing
# ═══════════════════════════════════════════════════════════════════════════════

usage() {
    echo -e "${BOLD}deploy_cpu.sh${NC} — Smart CPU Model Deployment via Ollama"
    echo ""
    echo -e "${CYAN}Usage:${NC}"
    echo "  $0 <huggingface-repo> [--background]"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  $0 meta-llama/Llama-3.2-3B-Instruct"
    echo "  $0 Qwen/Qwen2.5-7B-Instruct --background"
    echo "  $0 TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo "  --background    Run the model server in background (default: foreground)"
    echo ""
    echo -e "${CYAN}What it does:${NC}"
    echo "  1. Detects your system (OS, CPU, RAM)"
    echo "  2. Auto-picks the best GGUF quantization for your RAM"
    echo "  3. Shows a recommendation table"
    echo "  4. Warns about heavy models"
    echo "  5. Deploys via Ollama"
    echo "  6. Tests the API endpoint"
    exit 1
}

parse_args() {
    if [[ $# -lt 1 ]]; then
        usage
    fi

    HF_REPO="$1"
    RUN_MODE="foreground"

    # Validate HF repo format (must contain /)
    if [[ ! "$HF_REPO" =~ / ]]; then
        echo -e "${RED}ERROR: Invalid HuggingFace repo format.${NC}"
        echo "Expected format: org/repo-name (e.g., meta-llama/Llama-3.2-3B-Instruct)"
        exit 1
    fi

    shift
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --background|-b)
                RUN_MODE="background"
                shift
                ;;
            --quant)
                FORCE_QUANT="$2"
                shift 2
                ;;
            --help|-h)
                usage
                ;;
            *)
                echo -e "${RED}ERROR: Unknown option: $1${NC}"
                usage
                ;;
        esac
    done
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 3: OS & System Detection
# ═══════════════════════════════════════════════════════════════════════════════

detect_os() {
    local uname_out
    uname_out="$(uname -s)"

    case "$uname_out" in
        Darwin)
            echo "macos"
            ;;
        Linux)
            # Check for WSL
            if grep -qi "microsoft\|wsl" /proc/version 2>/dev/null; then
                echo "wsl"
            else
                echo "linux"
            fi
            ;;
        CYGWIN*|MINGW*|MSYS*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

detect_cpu() {
    local os="$1"

    case "$os" in
        macos)
            local arch
            arch="$(uname -m)"
            if [[ "$arch" == "arm64" ]]; then
                echo "apple_silicon"
            else
                echo "intel"
            fi
            ;;
        linux|wsl)
            if grep -qi "amd" /proc/cpuinfo 2>/dev/null; then
                echo "amd"
            else
                echo "intel"
            fi
            ;;
        *)
            echo "intel"
            ;;
    esac
}

detect_ram_gb() {
    local os="$1"

    case "$os" in
        macos)
            local bytes
            bytes="$(sysctl -n hw.memsize 2>/dev/null)"
            echo $(( bytes / 1073741824 ))
            ;;
        linux|wsl)
            local kb
            kb="$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')"
            echo $(( kb / 1048576 ))
            ;;
        *)
            echo "0"
            ;;
    esac
}

detect_available_ram_gb() {
    local os="$1"

    case "$os" in
        macos)
            # Parse vm_stat for free + inactive pages, then convert to GB
            local page_size free_pages inactive_pages speculative_pages
            page_size=$(vm_stat | head -1 | grep -o '[0-9]*')
            free_pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | tr -d '.')
            inactive_pages=$(vm_stat | grep "Pages inactive" | awk '{print $3}' | tr -d '.')
            speculative_pages=$(vm_stat | grep "Pages speculative" | awk '{print $3}' | tr -d '.' 2>/dev/null || echo "0")

            local available_bytes=$(( (free_pages + inactive_pages + speculative_pages) * page_size ))
            echo $(( available_bytes / 1073741824 ))
            ;;
        linux|wsl)
            local kb
            kb="$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}')"
            if [[ -n "$kb" ]]; then
                echo $(( kb / 1048576 ))
            else
                # Fallback: use free + buffers + cached
                local free buffers cached
                free=$(grep "^MemFree:" /proc/meminfo | awk '{print $2}')
                buffers=$(grep "^Buffers:" /proc/meminfo | awk '{print $2}')
                cached=$(grep "^Cached:" /proc/meminfo | awk '{print $2}')
                echo $(( (free + buffers + cached) / 1048576 ))
            fi
            ;;
        *)
            echo "0"
            ;;
    esac
}

detect_cores() {
    local os="$1"

    case "$os" in
        macos)
            sysctl -n hw.ncpu 2>/dev/null || echo "0"
            ;;
        linux|wsl)
            nproc 2>/dev/null || echo "0"
            ;;
        *)
            echo "0"
            ;;
    esac
}

print_system_report() {
    local os="$1" cpu="$2" total_ram="$3" avail_ram="$4" cores="$5" ram_budget="$6"

    # Prettify OS name
    local os_display
    case "$os" in
        macos)     os_display="macOS" ;;
        linux)     os_display="Linux" ;;
        wsl)       os_display="Windows (WSL)" ;;
        windows)   os_display="Windows" ;;
        *)         os_display="Unknown" ;;
    esac

    # Prettify CPU
    local cpu_display
    case "$cpu" in
        apple_silicon) cpu_display="Apple Silicon (Metal ⚡)" ;;
        intel)         cpu_display="Intel" ;;
        amd)           cpu_display="AMD" ;;
        *)             cpu_display="$cpu" ;;
    esac

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         ${BOLD}SYSTEM DETECTION${NC}${CYAN}                 ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║${NC}  OS:            ${BOLD}${os_display}${NC}"
    echo -e "${CYAN}║${NC}  CPU:           ${cpu_display}"
    echo -e "${CYAN}║${NC}  Cores:         ${cores}"
    echo -e "${CYAN}║${NC}  Total RAM:     ${total_ram} GB"
    echo -e "${CYAN}║${NC}  Available RAM:  ${avail_ram} GB"
    echo -e "${CYAN}║${NC}  RAM Budget:    ${BOLD}${ram_budget} GB${NC} ${DIM}(80% of available)${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 4: Ollama Check & Install
# ═══════════════════════════════════════════════════════════════════════════════

check_ollama() {
    if command -v ollama &>/dev/null; then
        return 0
    else
        return 1
    fi
}

install_ollama() {
    local os="$1"

    echo -e "${YELLOW}Ollama not found. Installing...${NC}"

    case "$os" in
        macos)
            if command -v brew &>/dev/null; then
                echo -e "${BLUE}Installing via Homebrew...${NC}"
                brew install ollama
            else
                echo -e "${BLUE}Installing via curl...${NC}"
                curl -fsSL https://ollama.com/install.sh | sh
            fi
            ;;
        linux|wsl)
            echo -e "${BLUE}Installing via official script...${NC}"
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        windows)
            echo -e "${RED}ERROR: Windows native is not supported.${NC}"
            echo "Please install WSL first:"
            echo "  1. Open PowerShell as Admin"
            echo "  2. Run: wsl --install"
            echo "  3. Restart, then run this script inside WSL"
            exit 1
            ;;
        *)
            echo -e "${RED}ERROR: Cannot auto-install Ollama on unknown OS.${NC}"
            echo "Please install manually: https://ollama.com/download"
            exit 1
            ;;
    esac

    # Verify installation
    if ! command -v ollama &>/dev/null; then
        echo -e "${RED}ERROR: Ollama installation failed.${NC}"
        echo "Please install manually: https://ollama.com/download"
        exit 1
    fi

    echo -e "${GREEN}✓ Ollama installed successfully${NC}"
}

ensure_ollama_running() {
    echo -e "${BLUE}Checking Ollama service...${NC}"

    # Check if Ollama API is responding
    if curl -sf "${OLLAMA_HOST}/api/tags" &>/dev/null; then
        echo -e "${GREEN}✓ Ollama is running${NC}"
        return 0
    fi

    # Try to start Ollama in background
    echo -e "${YELLOW}Starting Ollama service...${NC}"
    ollama serve &>/dev/null &
    OLLAMA_PID=$!

    # Wait for it to come up (max 15 seconds)
    local waited=0
    while [[ $waited -lt 15 ]]; do
        if curl -sf "${OLLAMA_HOST}/api/tags" &>/dev/null; then
            echo -e "${GREEN}✓ Ollama started (PID: ${OLLAMA_PID})${NC}"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    echo -e "${RED}ERROR: Could not start Ollama.${NC}"
    echo "Try running 'ollama serve' manually in another terminal."
    exit 1
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 5: Parse HF Repo & Detect Params
# ═══════════════════════════════════════════════════════════════════════════════

parse_hf_repo() {
    ORG=$(echo "$HF_REPO" | cut -d'/' -f1)
    REPO=$(echo "$HF_REPO" | cut -d'/' -f2)
    MODEL_NAME=$(echo "$REPO" | sed 's/-Instruct//g' | sed 's/-chat//gi' | sed 's/-Chat//gi' | tr '[:upper:]' '[:lower:]')
}

detect_param_count() {
    # Try to extract parameter count from repo name (e.g., "3B", "7B", "1.1B", "70B")
    local param_match
    param_match=$(echo "$REPO" | grep -oE '[0-9]+\.?[0-9]*[bB]' | head -1 | tr -d 'bB')

    if [[ -n "$param_match" ]]; then
        PARAM_BILLIONS="$param_match"
        echo -e "${GREEN}✓ Detected ${PARAM_BILLIONS}B parameters from model name${NC}"
        return 0
    fi

    # Fallback: check known models
    local repo_lower
    repo_lower=$(echo "$REPO" | tr '[:upper:]' '[:lower:]')
    local known_params
    known_params=$(lookup_known_model "$repo_lower")

    if [[ -n "$known_params" ]]; then
        PARAM_BILLIONS="$known_params"
        echo -e "${GREEN}✓ Detected ${PARAM_BILLIONS}B parameters (known model pattern)${NC}"
        return 0
    fi

    # Last fallback: ask user
    echo -e "${YELLOW}Could not detect parameter count from model name.${NC}"
    echo -e "Model: ${BOLD}${HF_REPO}${NC}"
    echo ""
    echo -n "Enter the parameter count in billions (e.g., 7 for 7B, 1.1 for 1.1B): "
    read -r PARAM_BILLIONS

    if [[ -z "$PARAM_BILLIONS" ]] || ! echo "$PARAM_BILLIONS" | grep -qE '^[0-9]+\.?[0-9]*$'; then
        echo -e "${RED}ERROR: Invalid parameter count.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Using ${PARAM_BILLIONS}B parameters${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 6: Quantization Table & RAM Calculator
# ═══════════════════════════════════════════════════════════════════════════════

calc_ram() {
    # Usage: calc_ram <params_billions> <quant_name>
    # Returns: required RAM in GB (float)
    local params="$1"
    local quant="$2"

    # Find rate for this quant
    local rate=""
    for i in "${!QUANT_NAMES[@]}"; do
        if [[ "${QUANT_NAMES[$i]}" == "$quant" ]]; then
            rate="${QUANT_RATES[$i]}"
            break
        fi
    done

    if [[ -z "$rate" ]]; then
        echo "0"
        return 1
    fi

    # RAM = params × rate + overhead
    echo "$params $rate $OVERHEAD_GB" | awk '{printf "%.1f", $1 * $2 + $3}'
}

pick_best_quant() {
    # Usage: pick_best_quant <params_billions> <ram_budget_gb>
    # Returns: best quant name that fits within budget
    # Strategy: try highest quality first at <60% budget, then <80%, then smallest
    local params="$1"
    local budget="$2"
    local best=""

    # Pass 1: Try highest quality that uses <60% of budget
    for (( i=${#QUANT_NAMES[@]}-1; i>=0; i-- )); do
        local ram
        ram=$(calc_ram "$params" "${QUANT_NAMES[$i]}")
        local pct
        pct=$(echo "$ram $budget" | awk '{printf "%.0f", ($1/$2)*100}')
        if [[ "$pct" -lt 60 ]]; then
            echo "${QUANT_NAMES[$i]}"
            return 0
        fi
    done

    # Pass 2: Try highest quality that uses <80% of budget
    for (( i=${#QUANT_NAMES[@]}-1; i>=0; i-- )); do
        local ram
        ram=$(calc_ram "$params" "${QUANT_NAMES[$i]}")
        local pct
        pct=$(echo "$ram $budget" | awk '{printf "%.0f", ($1/$2)*100}')
        if [[ "$pct" -lt 80 ]]; then
            echo "${QUANT_NAMES[$i]}"
            return 0
        fi
    done

    # Fallback: smallest quant
    echo "${QUANT_NAMES[0]}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 7: Recommendation Table & Warnings
# ═══════════════════════════════════════════════════════════════════════════════

get_warn_level() {
    # Usage: get_warn_level <ram_needed> <ram_budget>
    # Returns: none, info, warning, danger, refuse
    local needed="$1"
    local budget="$2"

    local pct
    pct=$(echo "$needed $budget" | awk '{printf "%.0f", ($1/$2)*100}')

    if [[ "$pct" -le 40 ]]; then
        echo "none"
    elif [[ "$pct" -le 60 ]]; then
        echo "info"
    elif [[ "$pct" -le 80 ]]; then
        echo "warning"
    elif [[ "$pct" -le 95 ]]; then
        echo "danger"
    else
        echo "refuse"
    fi
}

show_recommendation_table() {
    local params="$1"
    local budget="$2"
    local best_quant="$3"

    echo ""
    echo -e "${BOLD}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║                    QUANTIZATION OPTIONS                           ║${NC}"
    echo -e "${BOLD}╠══════════╦══════════╦════════╦════════════════╦════════════════════╣${NC}"
    echo -e "${BOLD}║  Quant   ║  RAM GB  ║  RAM%  ║    Quality     ║      Status        ║${NC}"
    echo -e "${BOLD}╠══════════╬══════════╬════════╬════════════════╬════════════════════╣${NC}"

    for i in "${!QUANT_NAMES[@]}"; do
        local quant="${QUANT_NAMES[$i]}"
        local quality="${QUANT_QUALITY[$i]}"
        local ram
        ram=$(calc_ram "$params" "$quant")
        local pct
        pct=$(echo "$ram $budget" | awk '{printf "%.0f", ($1/$2)*100}')

        # Status icon
        local status icon
        if [[ "$pct" -le 40 ]]; then
            icon="✅"
            status="Fits easily"
        elif [[ "$pct" -le 60 ]]; then
            icon="✅"
            status="Good fit"
        elif [[ "$pct" -le 80 ]]; then
            icon="⚠️ "
            status="Tight fit"
        elif [[ "$pct" -le 95 ]]; then
            icon="⚠️ "
            status="Very tight"
        else
            icon="❌"
            status="Won't fit"
        fi

        # Highlight recommended
        local marker=""
        if [[ "$quant" == "$best_quant" ]]; then
            marker=" ← ${GREEN}RECOMMENDED${NC}"
        fi

        printf "║  %-7s ║  %5.1f   ║  %3d%%  ║  %-13s ║  %s %-13s║%b\n" \
            "$quant" "$ram" "$pct" "$quality" "$icon" "$status" "$marker"
    done

    echo -e "${BOLD}╚══════════╩══════════╩════════╩════════════════╩════════════════════╝${NC}"
    echo ""
}

suggest_lighter_models() {
    local total_ram="$1"

    echo -e "${BLUE}💡 Suggested models for your system (${total_ram}GB RAM):${NC}"
    echo ""

    if [[ "$total_ram" -le 4 ]]; then
        echo "  • smollm:135m         — 92MB, tiny but functional"
        echo "  • tinyllama:1.1b      — ~0.6GB, good for testing"
        echo "  • phi-2               — ~1.6GB, surprisingly capable"
    elif [[ "$total_ram" -le 8 ]]; then
        echo "  • phi-3-mini (3.8B)   — ~2.3GB at Q4_K_M"
        echo "  • llama-3.2-1b        — ~0.6GB at Q4_K_M"
        echo "  • llama-3.2-3b        — ~1.8GB at Q4_K_M"
        echo "  • gemma-2b            — ~1.2GB at Q4_K_M"
    elif [[ "$total_ram" -le 16 ]]; then
        echo "  • llama-3.2-3b        — ~2.8GB at Q8_0 (best quality)"
        echo "  • qwen2.5-7b          — ~5.2GB at Q4_K_M"
        echo "  • mistral-7b          — ~5.2GB at Q4_K_M"
        echo "  • phi-3-mini (3.8B)   — ~2.3GB at Q4_K_M"
    elif [[ "$total_ram" -le 32 ]]; then
        echo "  • llama-3.1-8b        — ~5.8GB at Q4_K_M"
        echo "  • qwen2.5-14b         — ~8.4GB at Q4_K_M"
        echo "  • codellama-13b       — ~7.8GB at Q4_K_M"
        echo "  • mistral-7b          — ~5.2GB at Q4_K_M (high quality Q8_0)"
    else
        echo "  • llama-3.1-70b       — ~42GB at Q4_K_M"
        echo "  • qwen2.5-72b         — ~43GB at Q4_K_M"
        echo "  • mixtral-8x7b        — ~28GB at Q4_K_M"
    fi
    echo ""
}

warn_and_confirm() {
    local level="$1"
    local ram_needed="$2"
    local ram_budget="$3"
    local quant="$4"

    local pct
    pct=$(echo "$ram_needed $ram_budget" | awk '{printf "%.0f", ($1/$2)*100}')

    case "$level" in
        none)
            # Silent, proceed
            return 0
            ;;
        info)
            echo -e "${BLUE}ℹ️  This model will use ~${pct}% of your RAM budget.${NC}"
            echo -e "   RAM needed: ${ram_needed}GB | Budget: ${ram_budget}GB | Quant: ${quant}"
            echo ""
            echo -n "Proceed? [Y/n] "
            read -r answer
            if [[ "$answer" =~ ^[Nn]$ ]]; then
                echo -e "${YELLOW}Cancelled.${NC}"
                exit 0
            fi
            ;;
        warning)
            echo ""
            echo -e "${YELLOW}⚠️  WARNING: This model will use ~${pct}% of your RAM budget!${NC}"
            echo -e "   RAM needed: ${ram_needed}GB | Budget: ${ram_budget}GB | Quant: ${quant}"
            echo -e "${YELLOW}   Your system may become slow while the model is running.${NC}"
            echo ""
            echo -n "Continue anyway? [y/N] "
            read -r answer
            if [[ ! "$answer" =~ ^[Yy]$ ]]; then
                echo -e "${YELLOW}Cancelled.${NC}"
                suggest_lighter_models "$TOTAL_RAM_GB"
                exit 0
            fi
            ;;
        danger)
            echo ""
            echo -e "${RED}🚨 STRONG WARNING: This model will use ~${pct}% of your RAM budget!${NC}"
            echo -e "   RAM needed: ${ram_needed}GB | Budget: ${ram_budget}GB | Quant: ${quant}"
            echo -e "${RED}   This WILL cause severe system slowdown. Other apps may crash.${NC}"
            echo ""
            echo -e "${BOLD}Type CONFIRM to proceed, or anything else to cancel:${NC}"
            echo -n "> "
            read -r answer
            if [[ "$answer" != "CONFIRM" ]]; then
                echo -e "${YELLOW}Cancelled.${NC}"
                suggest_lighter_models "$TOTAL_RAM_GB"
                exit 0
            fi
            ;;
        refuse)
            echo ""
            echo -e "${RED}❌ REFUSED: This model requires ~${ram_needed}GB but your budget is only ${ram_budget}GB.${NC}"
            echo -e "${RED}   Even the smallest quantization (${quant}) is too large for your system.${NC}"
            echo ""
            suggest_lighter_models "$TOTAL_RAM_GB"
            exit 1
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 8: Deploy via Ollama
# ═══════════════════════════════════════════════════════════════════════════════

deploy_model() {
    local quant="$1"

    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║          ${BOLD}DEPLOYING MODEL${NC}${BLUE}                 ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Model:  ${BOLD}${HF_REPO}${NC}"
    echo -e "  Quant:  ${BOLD}${quant}${NC}"
    echo -e "  Mode:   ${RUN_MODE}"
    echo ""

    # ── Strategy 1: Try Ollama's native registry ──
    # Build a short name: e.g., "meta-llama/Llama-3.2-3B-Instruct" → "llama3.2:3b"
    # Ollama's registry uses short names, so we try the model name as-is first
    local ollama_native
    ollama_native=$(echo "$MODEL_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/-v[0-9.]*//')

    echo -e "${BLUE}Strategy 1: Trying Ollama registry...${NC}"
    echo -e "  Trying: ${DIM}ollama pull hf.co/${HF_REPO}${NC}"

    if ollama pull "hf.co/${HF_REPO}" 2>/dev/null; then
        echo -e "${GREEN}✓ Model downloaded from HuggingFace (default quant)${NC}"
        DEPLOYED_MODEL="hf.co/${HF_REPO}"
        return 0
    fi

    # ── Strategy 2: Try HuggingFace with specific quant tag ──
    local ollama_hf="hf.co/${HF_REPO}:${quant}"
    echo ""
    echo -e "${BLUE}Strategy 2: Trying HuggingFace GGUF...${NC}"
    echo -e "  Trying: ${DIM}ollama pull ${ollama_hf}${NC}"

    if ollama pull "$ollama_hf" 2>/dev/null; then
        echo -e "${GREEN}✓ Model downloaded from HuggingFace (${quant})${NC}"
        DEPLOYED_MODEL="$ollama_hf"
        return 0
    fi

    # ── Strategy 3: Try Ollama library with short name ──
    # Many popular models are in Ollama's library: llama3.2, qwen2.5, mistral, etc.
    local ollama_lib_name=""

    # Try to map common HF repos to Ollama library names
    local repo_lower
    repo_lower=$(echo "$REPO" | tr '[:upper:]' '[:lower:]')

    case "$repo_lower" in
        *llama-3.2*|*llama3.2*)
            ollama_lib_name="llama3.2:${PARAM_BILLIONS}b" ;;
        *llama-3.1*|*llama3.1*)
            ollama_lib_name="llama3.1:${PARAM_BILLIONS}b" ;;
        *llama-3*|*llama3*)
            ollama_lib_name="llama3:${PARAM_BILLIONS}b" ;;
        *qwen2.5*|*qwen-2.5*)
            ollama_lib_name="qwen2.5:${PARAM_BILLIONS}b" ;;
        *qwen2*|*qwen-2*)
            ollama_lib_name="qwen2:${PARAM_BILLIONS}b" ;;
        *mistral*)
            ollama_lib_name="mistral" ;;
        *mixtral*)
            ollama_lib_name="mixtral" ;;
        *phi-3*|*phi3*)
            ollama_lib_name="phi3" ;;
        *phi-2*|*phi2*)
            ollama_lib_name="phi" ;;
        *gemma-2*|*gemma2*)
            ollama_lib_name="gemma2:${PARAM_BILLIONS}b" ;;
        *gemma*)
            ollama_lib_name="gemma:${PARAM_BILLIONS}b" ;;
        *tinyllama*)
            ollama_lib_name="tinyllama" ;;
        *codellama*)
            ollama_lib_name="codellama" ;;
        *deepseek-coder*)
            ollama_lib_name="deepseek-coder" ;;
        *smollm*)
            ollama_lib_name="smollm:135m" ;;
    esac

    if [[ -n "$ollama_lib_name" ]]; then
        echo ""
        echo -e "${BLUE}Strategy 3: Trying Ollama library...${NC}"
        echo -e "  Trying: ${DIM}ollama pull ${ollama_lib_name}${NC}"

        if ollama pull "$ollama_lib_name" 2>/dev/null; then
            echo -e "${GREEN}✓ Model downloaded from Ollama library${NC}"
            DEPLOYED_MODEL="$ollama_lib_name"
            return 0
        fi
    fi

    # ── All strategies failed ──
    echo ""
    echo -e "${RED}ERROR: Could not pull model from any source.${NC}"
    echo ""
    echo "Tried:"
    echo "  1. ollama pull hf.co/${HF_REPO}"
    echo "  2. ollama pull hf.co/${HF_REPO}:${quant}"
    [[ -n "$ollama_lib_name" ]] && echo "  3. ollama pull ${ollama_lib_name}"
    echo ""
    echo -e "${YELLOW}Possible fixes:${NC}"
    echo "  • Check if the model has GGUF files on HuggingFace"
    echo "  • Search Ollama library: https://ollama.com/library"
    echo "  • Try a GGUF-specific repo, e.g.:"
    echo "    ./deploy_cpu.sh TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF"
    echo ""
    exit 1
}

start_model() {
    local model="$1"

    if [[ "$RUN_MODE" == "background" ]]; then
        echo -e "${BLUE}Starting model in background...${NC}"
        nohup ollama run "$model" --keepalive 0 </dev/null &>/dev/null &
        MODEL_PID=$!
        sleep 3
        echo -e "${GREEN}✓ Model running in background (PID: ${MODEL_PID})${NC}"
    else
        echo -e "${BLUE}Model is ready. Starting interactive session...${NC}"
        echo -e "${DIM}(Press Ctrl+D or type /bye to exit)${NC}"
        echo ""
        ollama run "$model"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 9: Test & Success
# ═══════════════════════════════════════════════════════════════════════════════

test_endpoint() {
    local model="$1"

    echo ""
    echo -e "${BLUE}Testing API endpoint...${NC}"

    # Test 1: Check if model is listed
    echo -n "  1. Model listed... "
    local tags
    tags=$(curl -sf "${OLLAMA_HOST}/api/tags" 2>/dev/null || echo "")
    if echo "$tags" | grep -qi "$(echo "$model" | cut -d':' -f1)"; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  (may still be loading)${NC}"
    fi

    # Test 2: Inference test
    echo -n "  2. Inference test... "
    local response
    response=$(curl -sf -X POST "${OLLAMA_HOST}/api/generate" \
        -d "{\"model\": \"${model}\", \"prompt\": \"Say hello in one word.\", \"stream\": false}" \
        2>/dev/null || echo "")

    if echo "$response" | grep -q "response"; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  (model may need more time to load)${NC}"
    fi

    # Test 3: OpenAI-compatible endpoint
    echo -n "  3. OpenAI API... "
    local oai_response
    oai_response=$(curl -sf -X POST "${OLLAMA_HOST}/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"${model}\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}], \"max_tokens\": 5}" \
        2>/dev/null || echo "")

    if echo "$oai_response" | grep -q "choices"; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️  (endpoint may not be ready yet)${NC}"
    fi

    echo ""
}

show_success() {
    local model="$1"
    local quant="$2"
    local ram_needed="$3"

    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ${BOLD}MODEL DEPLOYED SUCCESSFULLY! 🎉${NC}${GREEN}       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"

    echo ""
    echo -e "${BLUE}Model Information:${NC}"
    echo "  • HF Repo:     ${HF_REPO}"
    echo "  • Quantization: ${quant}"
    echo "  • RAM Usage:    ~${ram_needed}GB"
    echo "  • Parameters:   ${PARAM_BILLIONS}B"
    echo "  • Mode:         ${RUN_MODE}"

    echo ""
    echo -e "${BLUE}API Access (Ollama):${NC}"
    echo "  • Models:      ${OLLAMA_HOST}/api/tags"
    echo "  • Generate:    ${OLLAMA_HOST}/api/generate"
    echo "  • Chat:        ${OLLAMA_HOST}/v1/chat/completions"

    echo ""
    echo -e "${BLUE}Quick Test:${NC}"
    echo "  curl -X POST ${OLLAMA_HOST}/v1/chat/completions \\"
    echo "    -H \"Content-Type: application/json\" \\"
    echo "    -d '{\"model\": \"${model}\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}'"

    echo ""
    echo -e "${BLUE}Commands:${NC}"
    echo "  • Chat:     ollama run ${model}"
    echo "  • Stop:     ollama stop ${model}"
    echo "  • Remove:   ollama rm ${model}"
    echo "  • List:     ollama list"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Section 10: Main Execution
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    parse_args "$@"

    # ── Banner ──
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   ${BOLD}deploy_cpu.sh — Smart CPU Deployment${NC}${CYAN}   ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Model: ${BOLD}${HF_REPO}${NC}"
    echo -e "  Mode:  ${RUN_MODE}"
    echo ""

    # ── Phase 1: System Detection ──
    echo -e "${BLUE}── Phase 1: System Detection ──${NC}"
    OS=$(detect_os)
    CPU=$(detect_cpu "$OS")
    TOTAL_RAM_GB=$(detect_ram_gb "$OS")
    AVAIL_RAM_GB=$(detect_available_ram_gb "$OS")
    CORES=$(detect_cores "$OS")

    # RAM budget = 80% of available
    RAM_BUDGET_GB=$(echo "$AVAIL_RAM_GB" | awk '{printf "%.0f", $1 * 0.80}')
    # Ensure at least 1 GB budget
    if [[ "$RAM_BUDGET_GB" -lt 1 ]]; then
        RAM_BUDGET_GB=1
    fi

    print_system_report "$OS" "$CPU" "$TOTAL_RAM_GB" "$AVAIL_RAM_GB" "$CORES" "$RAM_BUDGET_GB"

    # ── Phase 2: Ollama ──
    echo -e "${BLUE}── Phase 2: Ollama Setup ──${NC}"
    if check_ollama; then
        echo -e "${GREEN}✓ Ollama found: $(which ollama)${NC}"
    else
        install_ollama "$OS"
    fi
    ensure_ollama_running

    # ── Phase 3: Parse Model ──
    echo ""
    echo -e "${BLUE}── Phase 3: Model Analysis ──${NC}"
    parse_hf_repo
    echo -e "  Organization: ${ORG}"
    echo -e "  Repository:   ${REPO}"

    detect_param_count

    # ── Phase 4: Quantization Calculation ──
    echo ""
    echo -e "${BLUE}── Phase 4: Quantization Selection ──${NC}"
    BEST_QUANT=$(pick_best_quant "$PARAM_BILLIONS" "$RAM_BUDGET_GB")
    RAM_NEEDED=$(calc_ram "$PARAM_BILLIONS" "$BEST_QUANT")

    # Override with user-selected quantization if provided
    if [[ -n "$FORCE_QUANT" ]]; then
        BEST_QUANT="$FORCE_QUANT"
        RAM_NEEDED=$(calc_ram "$PARAM_BILLIONS" "$BEST_QUANT")
        echo -e "${BLUE}Using user-selected quantization: ${BOLD}${BEST_QUANT}${NC}"
    fi

    echo -e "  Best quantization: ${BOLD}${BEST_QUANT}${NC}"
    echo -e "  Estimated RAM:     ${RAM_NEEDED}GB / ${RAM_BUDGET_GB}GB budget"

    show_recommendation_table "$PARAM_BILLIONS" "$RAM_BUDGET_GB" "$BEST_QUANT"

    # ── Phase 5: Warning & Confirmation ──
    WARN_LEVEL=$(get_warn_level "$RAM_NEEDED" "$RAM_BUDGET_GB")
    warn_and_confirm "$WARN_LEVEL" "$RAM_NEEDED" "$RAM_BUDGET_GB" "$BEST_QUANT"

    # ── Phase 6: Deploy ──
    deploy_model "$BEST_QUANT"

    # ── Phase 7: Test ──
    if [[ "$RUN_MODE" == "background" ]]; then
        start_model "$DEPLOYED_MODEL"
        test_endpoint "$DEPLOYED_MODEL"
        show_success "$DEPLOYED_MODEL" "$BEST_QUANT" "$RAM_NEEDED"
    else
        show_success "$DEPLOYED_MODEL" "$BEST_QUANT" "$RAM_NEEDED"
        echo -e "${BLUE}Starting interactive chat...${NC}"
        echo -e "${DIM}(The model will be loaded into memory on first message)${NC}"
        echo ""
        start_model "$DEPLOYED_MODEL"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Testable entry point: skip main() when sourced by test files
# ═══════════════════════════════════════════════════════════════════════════════
if [[ "${TESTING:-0}" != "1" ]]; then
    main "$@"
fi
