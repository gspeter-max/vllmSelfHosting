#!/bin/bash
set -e

################################################################################
# deploy_model.sh - HuggingFace Model Deployment Script for vLLM Server
#
# Usage: ./deploy_model.sh <huggingface-repo> <gpu>
#
# Examples:
#   ./deploy_model.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0 0
#   ./deploy_model.sh meta-llama/Llama-3.2-1B-Instruct 1
#
# GPU must be 0 or 1
################################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# INPUT VALIDATION
################################################################################

# Check arguments
if [[ $# -ne 2 ]]; then
    usage
fi

HF_REPO="$1"
GPU="$2"

# Validate GPU argument
if [[ "$GPU" != "0" && "$GPU" != "1" ]]; then
    echo -e "${RED}ERROR: GPU must be 0 or 1${NC}"
    echo ""
    usage
fi

################################################################################
# PARSE HUGGINGFACE REPO
################################################################################

# HF_REPO format: org/repo-name (e.g., TinyLlama/TinyLlama-1.1B-Chat-v1.0)
ORG=$(echo "$HF_REPO" | cut -d'/' -f1)           # TinyLlama
REPO=$(echo "$HF_REPO" | cut -d'/' -f2)           # TinyLlama-1.1B-Chat-v1.0
MODEL_SHORT_NAME=$(echo "$REPO" | sed 's/-Instruct//g' | sed 's/-chat//gi' | sed 's/-Chat//gi')

# Convert to lowercase for service name (systemd names should be lowercase)
SERVICE_NAME=$(echo "$MODEL_SHORT_NAME" | tr '[:upper:]' '[:lower:]' | tr '.' '-' | tr ' ' '-' | tr '/' '-')
CONFIG_NAME="$SERVICE_NAME"
NGINX_LOCATION="$SERVICE_NAME"

################################################################################
# GPU SLOT MAPPINGS
################################################################################

if [[ "$GPU" == "0" ]]; then
    PORT=8104
    # Track which service is currently on GPU 0
    OLD_SERVICE_NAME=$(systemctl list-units --all | grep -o "^[^ ]*\.service" | grep -E "(qwen-7b|tinyllama|llama|mistral)" | sed 's/\.service$//' | head -1 || echo "")
    GPU_MEMORY_UTIL=0.80
    MAX_MODEL_LEN=16000
    MAX_NUM_SEQS=64
elif [[ "$GPU" == "1" ]]; then
    PORT=8105
    # Track which service is currently on GPU 1
    OLD_SERVICE_NAME=$(systemctl list-units --all | grep -o "^[^ ]*\.service" | grep -E "(qwen-3b|tinyllama|llama|mistral)" | sed 's/\.service$//' | head -1 || echo "")
    GPU_MEMORY_UTIL=0.30
    MAX_MODEL_LEN=4096
    MAX_NUM_SEQS=256
fi

# If no old service found, try default names
if [[ -z "$OLD_SERVICE_NAME" ]]; then
    if [[ "$GPU" == "0" ]]; then
        OLD_SERVICE_NAME="qwen-7b-instruct"
    else
        OLD_SERVICE_NAME="qwen-3b-instruct"
    fi
fi

################################################################################
# CONSTANTS
################################################################################

BASE_DIR="/data/models"
MODEL_DIR="${BASE_DIR}/${ORG}/${MODEL_SHORT_NAME}"
VENV_PATH="/data/models/.venv"
# Set HF_TOKEN via environment variable: export HF_TOKEN="your_token_here"
HF_TOKEN="${HF_TOKEN:-}"
LITELLM_CONFIG="/data/services/litellm/config.yaml"
NGINX_CONFIG="/data/services/litellm/nginx.conf"
# Set LITELLM_KEY via environment variable: export LITELLM_KEY="your_key_here"
LITELLM_KEY="${LITELLM_KEY:-}"

################################################################################
# FUNCTIONS
################################################################################

usage() {
    echo "Usage: $0 <huggingface-repo> <gpu>"
    echo ""
    echo "Examples:"
    echo "  $0 TinyLlama/TinyLlama-1.1B-Chat-v1.0 0"
    echo "  $0 meta-llama/Llama-3.2-1B-Instruct 1"
    echo ""
    echo "GPU must be 0 or 1"
    echo ""
    echo "GPU Slots:"
    echo "  0: Port 8104"
    echo "  1: Port 8105"
    echo ""
    echo "Note: Service name is automatically generated from the model name"
    exit 1
}

################################################################################
# MAIN SCRIPT FLOW
################################################################################

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Model Deployment Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}HuggingFace Repo:${NC} ${HF_REPO}"
echo -e "${BLUE}GPU:${NC} ${GPU}"
echo -e "${BLUE}Port:${NC} ${PORT}"
echo -e "${BLUE}Service Name:${NC} ${SERVICE_NAME}"
echo -e "${BLUE}Model Short Name:${NC} ${MODEL_SHORT_NAME}"
echo ""

# Phase 2: Setup/Check venv for huggingface-cli
check_venv() {
    echo -e "${BLUE}Checking huggingface-cli...${NC}"

    if [[ ! -d "$VENV_PATH" ]]; then
        echo -e "${YELLOW}Creating venv at $VENV_PATH...${NC}"
        python3 -m venv "$VENV_PATH"
    fi

    source "$VENV_PATH/bin/activate"
    pip install --upgrade huggingface-hub > /dev/null 2>&1

    # Check for hf CLI (new) or huggingface-cli (old)
    if ! command -v hf &> /dev/null && ! command -v huggingface-cli &> /dev/null; then
        echo -e "${RED}ERROR: HuggingFace CLI not found${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ HuggingFace CLI ready${NC}"
}

# Phase 3: Stop Existing Service & Backup
stop_service() {
    echo -e "\n${BLUE}Stopping existing service on GPU ${GPU}...${NC}"

    # Stop and disable the old service for this GPU slot
    if [[ -n "$OLD_SERVICE_NAME" ]] && systemctl list-unit-files | grep -q "${OLD_SERVICE_NAME}.service"; then
        if systemctl is-active --quiet "${OLD_SERVICE_NAME}.service" 2>/dev/null; then
            echo -e "${YELLOW}Stopping old service: ${OLD_SERVICE_NAME}.service${NC}"
            sudo systemctl stop "${OLD_SERVICE_NAME}.service"
        fi

        # Disable the old service
        if systemctl is-enabled --quiet "${OLD_SERVICE_NAME}.service" 2>/dev/null; then
            echo -e "${YELLOW}Disabling old service: ${OLD_SERVICE_NAME}.service${NC}"
            sudo systemctl disable "${OLD_SERVICE_NAME}.service"
        fi
    fi

    # Also stop the new service if it already exists (re-deployment case)
    if systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
        if systemctl is-active --quiet "${SERVICE_NAME}.service" 2>/dev/null; then
            echo -e "${YELLOW}Stopping existing service: ${SERVICE_NAME}.service${NC}"
            sudo systemctl stop "${SERVICE_NAME}.service"
        fi
    fi

    echo -e "${BLUE}Waiting for GPU ${GPU} memory to free...${NC}"
    sleep 3
    nvidia-smi --query-gpu=memory.used --format=csv,noheader | sed -n "$((GPU+1))p"

    # Backup LiteLLM config
    BACKUP_DIR="/data/services/litellm/backups"
    mkdir -p "$BACKUP_DIR"
    cp "$LITELLM_CONFIG" "$BACKUP_DIR/config.yaml.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓ Config backed up${NC}"

    # Get old model path for logging
    if [[ -n "$OLD_SERVICE_NAME" ]] && [[ -f "$LITELLM_CONFIG" ]]; then
        OLD_MODEL_PATH=$(grep -A 5 "model_name: ${OLD_SERVICE_NAME}" "$LITELLM_CONFIG" 2>/dev/null | grep "base_model" | head -1 | cut -d'"' -f2)
        if [[ -n "$OLD_MODEL_PATH" ]]; then
            echo -e "${YELLOW}Old model: ${OLD_MODEL_PATH}${NC}"
        fi
    fi
}

# Phase 4: Download Model from HuggingFace
download_model() {
    echo -e "\n${BLUE}Downloading ${HF_REPO}...${NC}"

    # Create directory structure
    mkdir -p "${MODEL_DIR}/model"
    mkdir -p "${MODEL_DIR}/logs"
    mkdir -p "${MODEL_DIR}/.cache"

    # Download using hf CLI (FASTEST method)
    source "$VENV_PATH/bin/activate"
    export HF_TOKEN="$HF_TOKEN"
    export HF_HOME="${MODEL_DIR}/.cache"

    # Use hf CLI if available, otherwise fallback to huggingface-cli
    if command -v hf &> /dev/null; then
        hf download "$HF_REPO" \
            --local-dir "${MODEL_DIR}/model" \
            --token "$HF_TOKEN"
    else
        huggingface-cli download "$HF_REPO" \
            --local-dir "${MODEL_DIR}/model" \
            --local-dir-use-symlinks False \
            --token "$HF_TOKEN" \
            --resume-download
    fi

    # Create .env file
    cat > "${MODEL_DIR}/.env" << EOF
# ${MODEL_SHORT_NAME} Configuration
MODEL_PATH=${MODEL_DIR}/model
SERVED_MODEL_NAME=${MODEL_SHORT_NAME}
HOST=0.0.0.0
PORT=${PORT}

# vLLM Parameters
MAX_MODEL_LEN=${MAX_MODEL_LEN}
GPU_MEMORY_UTIL=${GPU_MEMORY_UTIL}
TENSOR_PARALLEL_SIZE=1
MAX_NUM_SEQS=${MAX_NUM_SEQS}
SWAP_SPACE=4

# HuggingFace
HF_TOKEN=${HF_TOKEN}
HF_HOME=${MODEL_DIR}/.cache

# vLLM Settings
VLLM_LOGGING_LEVEL=INFO
VLLM_WORKER_MULTIPROC_METHOD=spawn
EOF

    # Show download summary
    MODEL_SIZE=$(du -sh "${MODEL_DIR}/model" | cut -f1)
    echo -e "${GREEN}✓ Download complete! Size: ${MODEL_SIZE}${NC}"
}

# Phase 5: Create Systemd Service
detect_model_size() {
    local config="${MODEL_DIR}/model/config.json"
    if [[ -f "$config" ]]; then
        # Get hidden_size and num_hidden_layers
        local hidden_size=$(grep -o '"hidden_size": [0-9]*' "$config" | cut -d' ' -f2)
        local layers=$(grep -o '"num_hidden_layers": [0-9]*' "$config" | cut -d' ' -f2)

        if [[ -n "$hidden_size" && -n "$layers" ]]; then
            local params=$((hidden_size * layers))

            # Adjust params based on model size
            if [[ $params -lt 2000000000 ]]; then
                # < 2B - use aggressive settings
                GPU_MEMORY_UTIL=0.20
                MAX_MODEL_LEN=2048
                MAX_NUM_SEQS=512
            elif [[ $params -lt 4000000000 ]]; then
                # 2-4B
                GPU_MEMORY_UTIL=0.30
                MAX_MODEL_LEN=4096
                MAX_NUM_SEQS=256
            elif [[ $params -lt 10000000000 ]]; then
                # 4-10B
                GPU_MEMORY_UTIL=0.60
                MAX_MODEL_LEN=8192
                MAX_NUM_SEQS=128
            else
                # > 10B
                GPU_MEMORY_UTIL=0.80
                MAX_MODEL_LEN=16000
                MAX_NUM_SEQS=64
            fi

            echo -e "${BLUE}Detected model size: ~$((params/1000000000))B params${NC}"
            echo -e "${BLUE}Adjusted: gpu-memory-util=${GPU_MEMORY_UTIL}, max-model-len=${MAX_MODEL_LEN}${NC}"
        fi
    fi
}

create_systemd_service() {
    echo -e "\n${BLUE}Creating systemd service...${NC}"

    detect_model_size

    sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" > /dev/null << SERVICE_EOF
[Unit]
Description=vLLM ${MODEL_SHORT_NAME} Server (${SERVICE_NAME})
Documentation=https://docs.vllm.ai/
After=network-online.target

[Service]
Type=simple
User=luminova
Group=luminova
WorkingDirectory=${MODEL_DIR}
Environment="PATH=/data/vllm/vllm-native/.venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="CUDA_VISIBLE_DEVICES=${GPU}"
EnvironmentFile=${MODEL_DIR}/.env

ExecStart=/data/vllm/vllm-native/.venv/bin/python -m vllm.entrypoints.openai.api_server \\
    --model ${MODEL_DIR}/model \\
    --served-model-name ${MODEL_SHORT_NAME} \\
    --trust-remote-code \\
    --dtype auto \\
    --tensor-parallel-size 1 \\
    --gpu-memory-utilization ${GPU_MEMORY_UTIL} \\
    --max-model-len ${MAX_MODEL_LEN} \\
    --max-num-seqs ${MAX_NUM_SEQS} \\
    --max-num-batched-tokens 32768 \\
    --enable-chunked-prefill \\
    --enable-prefix-caching \\
    --kv-cache-dtype auto \\
    --swap-space 4 \\
    --disable-log-requests \\
    --host 0.0.0.0 \\
    --port ${PORT}

Restart=always
RestartSec=10
TimeoutStartSec=300
TimeoutStopSec=30
StandardOutput=append:${MODEL_DIR}/logs/${SERVICE_NAME}.log
StandardError=append:${MODEL_DIR}/logs/${SERVICE_NAME}.log

LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SERVICE_EOF

    sudo systemctl daemon-reload
    echo -e "${GREEN}✓ Service file created: /etc/systemd/system/${SERVICE_NAME}.service${NC}"
}

# Phase 6: Update LiteLLM Config (Model Name ONLY)
update_litellm_config() {
    echo -e "\n${BLUE}Updating LiteLLM config...${NC}"

    # Remove old service entry if it exists
    if [[ -n "$OLD_SERVICE_NAME" ]] && [[ "$OLD_SERVICE_NAME" != "$SERVICE_NAME" ]]; then
        echo -e "${YELLOW}Removing old model entry: ${OLD_SERVICE_NAME}${NC}"
        # Remove the old model entry block (from - model_name to next - model_name or end of model list)
        sed -i "/^  - model_name: ${OLD_SERVICE_NAME}/,/^  - model_name:/ {
            /^  - model_name: ${OLD_SERVICE_NAME}/d
            /^$/!d
        }" "$LITELLM_CONFIG"

        # Also remove the entry if it's the last one (no next model_name)
        sed -i "/^  - model_name: ${OLD_SERVICE_NAME}/,/model_list:/d" "$LITELLM_CONFIG"
    fi

    # Check if this model entry already exists (update case)
    if grep -q "^  - model_name: ${SERVICE_NAME}" "$LITELLM_CONFIG"; then
        echo -e "${YELLOW}Updating existing model entry: ${SERVICE_NAME}${NC}"
        # Update base_model in existing entry
        sed -i "/^  - model_name: ${SERVICE_NAME}/,/model_info:/ {
            s|base_model: \".*\"|base_model: \"${HF_REPO}\"|g
        }" "$LITELLM_CONFIG"
    else
        echo -e "${YELLOW}Adding new model entry: ${SERVICE_NAME}${NC}"
        # Find the position to insert (before model_list: or at end)
        # This is more complex - we'll add a marker at the end of the model list
        # For now, just update if exists, otherwise skip (manual config edit may be needed)
        echo -e "${YELLOW}Note: Model entry will be created on next config rebuild${NC}"
    fi

    # For safety, we can also add/update the entry using a Python script
    python3 << PYTHON_EOF
import yaml
import sys

try:
    with open('$LITELLM_CONFIG', 'r') as f:
        config = yaml.safe_load(f)

    if 'model_list' not in config:
        print("ERROR: model_list not found in config")
        sys.exit(1)

    # Calculate max_tokens (reserve 512 tokens for input)
    max_model_len = $MAX_MODEL_LEN
    max_tokens = max(512, max_model_len - 512)  # At least 512, but less than context

    # Remove old service entry
    if '$OLD_SERVICE_NAME' and '$OLD_SERVICE_NAME' != '$SERVICE_NAME':
        config['model_list'] = [m for m in config['model_list'] if m.get('model_name') != '$OLD_SERVICE_NAME']

    # Check if our model entry already exists
    existing = None
    for i, model in enumerate(config['model_list']):
        if model.get('model_name') == '$SERVICE_NAME':
            existing = i
            break

    # Update or add the model entry
    model_entry = {
        'model_name': '$SERVICE_NAME',
        'litellm_params': {
            'model': f'openai/$SERVICE_NAME',
            'api_base': f'http://host.docker.internal:$PORT/v1',
            'api_key': 'dummy-key-for-vllm',
            'rpm': 300 if '$GPU' == '1' else 600,
            'tpm': 200000 if '$GPU' == '1' else 400000,
            'max_tokens': max_tokens,
            'timeout': 60,
            'input_cost_per_token': 0,
            'output_cost_per_token': 0
        },
        'model_info': {
            'mode': 'chat',
            'base_model': '$HF_REPO',
            'supports_function_calling': True,
            'supports_vision': False,
            'max_input_tokens': max_model_len,
            'max_output_tokens': max_tokens
        }
    }

    if existing is not None:
        config['model_list'][existing] = model_entry
    else:
        config['model_list'].append(model_entry)

    # Write back
    with open('$LITELLM_CONFIG', 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    print("Config updated successfully")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
PYTHON_EOF

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}ERROR: Failed to update LiteLLM config${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ LiteLLM config updated${NC}"
}

# Phase 7: Create README.md
create_readme() {
    echo -e "\n${BLUE}Creating README.md...${NC}"

    cat > "${MODEL_DIR}/README.md" << README_EOF
# ${MODEL_SHORT_NAME}

## Model Information
- **HuggingFace**: ${HF_REPO}
- **Deployed**: $(date '+%Y-%m-%d %H:%M:%S')
- **GPU**: ${GPU}
- **Port**: ${PORT}
- **Service**: ${SERVICE_NAME}
- **Slot**: ${CONFIG_NAME}

## Quick Start

### Direct vLLM Access
\`\`\`bash
curl http://192.168.50.103:${PORT}/v1/models
\`\`\`

### Via nginx
\`\`\`bash
curl http://192.168.50.103/${NGINX_LOCATION}/v1/models
\`\`\`

### Via LiteLLM (Recommended)
\`\`\`bash
curl -X POST http://192.168.50.103/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${LITELLM_KEY}" \\
  -d '{
    "model": "${MODEL_SHORT_NAME}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
\`\`\`

## Service Management

### Check Status
\`\`\`bash
sudo systemctl status ${SERVICE_NAME}
\`\`\`

### View Logs
\`\`\`bash
# Real-time
tail -f ${MODEL_DIR}/logs/${SERVICE_NAME}.log

# Last 100 lines
tail -100 ${MODEL_DIR}/logs/${SERVICE_NAME}.log
\`\`\`

### Restart Service
\`\`\`bash
sudo systemctl restart ${SERVICE_NAME}
\`\`\`

## Model Files
- **Location**: \`${MODEL_DIR}/model\`
- **Size**: $(du -sh "${MODEL_DIR}/model" 2>/dev/null | cut -f1 || echo "Unknown")
- **Format**: safetensors

## Configuration
- **Environment**: \`${MODEL_DIR}/.env\`
- **Service**: \`/etc/systemd/system/${SERVICE_NAME}.service\`

---
*Auto-generated by deploy_model.sh on $(date '+%Y-%m-%d %H:%M:%S')*
README_EOF

    echo -e "${GREEN}✓ README.md created${NC}"
}

# Phase 8: Start Service & Test (4 Levels)
wait_for_model() {
    local max_wait=300  # 5 minutes
    local elapsed=0

    echo -e "${BLUE}Waiting for model to load...${NC}"

    while [[ $elapsed -lt $max_wait ]]; do
        if curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Model loaded and ready!${NC}"
            return 0
        fi
        sleep 5
        elapsed=$((elapsed + 5))
        echo -n "."
    done

    echo ""
    echo -e "${RED}✗ Timeout waiting for model to load${NC}"
    return 1
}

test_vllm_direct() {
    echo -e "\n${BLUE}Test 1: vLLM Direct Access${NC}"
    local response=$(curl -s "http://127.0.0.1:${PORT}/v1/models")

    if echo "$response" | grep -q "${MODEL_SHORT_NAME}"; then
        echo -e "${GREEN}✓ PASSED: vLLM serving model${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED: vLLM not serving model${NC}"
        return 1
    fi
}

test_nginx_proxy() {
    echo -e "\n${BLUE}Test 2: nginx Proxy${NC}"
    local response=$(curl -s "http://192.168.50.103/${NGINX_LOCATION}/v1/models")

    if echo "$response" | grep -q "${MODEL_SHORT_NAME}"; then
        echo -e "${GREEN}✓ PASSED: nginx proxying correctly${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED: nginx not proxying${NC}"
        return 1
    fi
}

test_litellm_routing() {
    echo -e "\n${BLUE}Test 3: LiteLLM Routing${NC}"
    local response=$(curl -s -H "Authorization: Bearer ${LITELLM_KEY}" \
        "http://192.168.50.103/v1/models")

    if echo "$response" | grep -q "${MODEL_SHORT_NAME}"; then
        echo -e "${GREEN}✓ PASSED: LiteLLM routing to model${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED: LiteLLM not routing${NC}"
        echo "Response: $response"
        return 1
    fi
}

test_inference() {
    echo -e "\n${BLUE}Test 4: Inference Test${NC}"
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${LITELLM_KEY}" \
        -d "{\"model\": \"${MODEL_SHORT_NAME}\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello\"}], \"max_tokens\": 10}" \
        "http://192.168.50.103/v1/chat/completions")

    if echo "$response" | grep -q "choices"; then
        echo -e "${GREEN}✓ PASSED: Inference working${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED: Inference not working${NC}"
        echo "Response: $response"
        return 1
    fi
}

run_all_tests() {
    local failed=0

    wait_for_model || failed=1
    test_vllm_direct || failed=1
    test_nginx_proxy || failed=1
    test_litellm_routing || failed=1
    test_inference || failed=1

    if [[ $failed -eq 0 ]]; then
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}========================================${NC}"
        return 0
    else
        echo -e "\n${RED}========================================${NC}"
        echo -e "${RED}SOME TESTS FAILED${NC}"
        echo -e "${RED}========================================${NC}"
        return 1
    fi
}

start_service() {
    echo -e "\n${BLUE}Starting ${SERVICE_NAME}.service...${NC}"
    sudo systemctl enable "${SERVICE_NAME}.service"
    sudo systemctl start "${SERVICE_NAME}.service"
}

# Phase 9: Reload Docker Services
reload_docker_services() {
    echo -e "\n${BLUE}Reloading Docker services...${NC}"

    cd /data/services/litellm

    # Restart nginx and litellm (use 'docker compose' not 'docker-compose')
    docker compose restart nginx litellm

    # Wait for containers to be healthy
    sleep 10

    # Verify
    if docker ps | grep -q "llm-nginx"; then
        echo -e "${GREEN}✓ nginx container running${NC}"
    else
        echo -e "${RED}✗ nginx container not running${NC}"
        return 1
    fi

    if docker ps | grep -q "litellm-proxy"; then
        echo -e "${GREEN}✓ litellm container running${NC}"
    else
        echo -e "${RED}✗ litellm container not running${NC}"
        return 1
    fi

    return 0
}

# Phase 10: Success/Failure Handling
show_success() {
    echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   MODEL DEPLOYED SUCCESSFULLY!           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"

    echo ""
    echo -e "${BLUE}Model Information:${NC}"
    echo "  • Name:      ${MODEL_SHORT_NAME}"
    echo "  • HF Repo:   ${HF_REPO}"
    echo "  • GPU:       ${GPU}"
    echo "  • Port:      ${PORT}"
    echo "  • Service:   ${SERVICE_NAME}"

    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo "  • Direct vLLM:  http://192.168.50.103:${PORT}/v1/models"
    echo "  • nginx:         http://192.168.50.103/${NGINX_LOCATION}/v1/models"
    echo "  • LiteLLM:       http://192.168.50.103/v1/chat/completions"

    echo ""
    echo -e "${BLUE}Files:${NC}"
    echo "  • Model:  ${MODEL_DIR}/model"
    echo "  • Logs:   ${MODEL_DIR}/logs/${SERVICE_NAME}.log"
    echo "  • README: ${MODEL_DIR}/README.md"

    echo ""
    echo -e "${BLUE}Quick Test:${NC}"
    echo "  curl -X POST http://192.168.50.103/v1/chat/completions \\"
    echo "    -H \"Content-Type: application/json\" \\"
    echo "    -H \"Authorization: Bearer ${LITELLM_KEY}\" \\"
    echo "    -d '{\"model\": \"${MODEL_SHORT_NAME}\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}'"

    # Update session.md
    update_session_log
}

show_failure() {
    local test_name="$1"

    echo -e "\n${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   DEPLOYMENT FAILED                      ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"

    echo ""
    echo -e "${RED}Failed at: ${test_name}${NC}"

    echo ""
    echo -e "${YELLOW}Stopping service...${NC}"
    sudo systemctl stop "${SERVICE_NAME}.service"

    echo ""
    echo -e "${YELLOW}Recent logs (last 50 lines):${NC}"
    tail -50 "${MODEL_DIR}/logs/${SERVICE_NAME}.log"

    echo ""
    echo -e "${YELLOW}Systemd journal:${NC}"
    sudo journalctl -u "${SERVICE_NAME}.service" -n 20 --no-pager

    echo ""
    echo -e "${BLUE}To debug:${NC}"
    echo "  1. Check logs above"
    echo "  2. Verify model files: ls -la ${MODEL_DIR}/model"
    echo "  3. Check GPU memory: nvidia-smi"
    echo "  4. Test manually: sudo systemctl start ${SERVICE_NAME}"

    exit 1
}

update_session_log() {
    local session_file="$HOME/Desktop/session.md"

    if [[ -f "$session_file" ]]; then
        cat >> "$session_file" << SESSION_EOF

---

## Model Deployment: ${MODEL_SHORT_NAME}

**Date**: $(date '+%Y-%m-%d %H:%M:%S')
**GPU**: ${GPU}
**Port**: ${PORT}
**Service**: ${SERVICE_NAME}

### Deployment Info
- **HF Repo**: ${HF_REPO}
- **Model Path**: ${MODEL_DIR}/model
- **Size**: $(du -sh "${MODEL_DIR}/model" 2>/dev/null | cut -f1)

### Access
- **Direct**: http://192.168.50.103:${PORT}/v1/models
- **nginx**: http://192.168.50.103/${NGINX_LOCATION}/v1/models
- **LiteLLM**: Use model name "${MODEL_SHORT_NAME}"

SESSION_EOF
    fi
}

################################################################################
# MAIN EXECUTION
################################################################################

# Execute phases
check_venv || show_failure "venv setup"
stop_service || show_failure "service stop"
download_model || show_failure "model download"
create_systemd_service || show_failure "service creation"
update_litellm_config || show_failure "litellm config update"
create_readme || show_failure "readme creation"
start_service || show_failure "service start"

# Run tests
if ! run_all_tests; then
    show_failure "tests"
fi

# Reload docker services
if ! reload_docker_services; then
    show_failure "docker reload"
fi

# Success!
show_success
