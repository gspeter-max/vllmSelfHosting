#!/bin/bash
# test/test_model_parser.sh — Unit tests for HF repo parsing & param detection
#
# Sources deploy_cpu.sh with TESTING=1 to access functions without running main()

set +e
export TESTING=1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../deploy_cpu.sh"

PASS=0
FAIL=0

# ── Test 1: Parse meta-llama/Llama-3.2-3B-Instruct ──
test_parse_llama3b() {
    HF_REPO="meta-llama/Llama-3.2-3B-Instruct"
    parse_hf_repo
    detect_param_count
    if [[ "$PARAM_BILLIONS" == "3" ]]; then
        echo "✅ Llama-3.2-3B → ${PARAM_BILLIONS}B"
        PASS=$((PASS+1))
    else
        echo "❌ Llama-3.2-3B → ${PARAM_BILLIONS}B, expected 3"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 2: Parse TinyLlama/TinyLlama-1.1B-Chat-v1.0 ──
test_parse_tinyllama() {
    HF_REPO="TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    parse_hf_repo
    detect_param_count
    if [[ "$PARAM_BILLIONS" == "1.1" ]]; then
        echo "✅ TinyLlama-1.1B → ${PARAM_BILLIONS}B"
        PASS=$((PASS+1))
    else
        echo "❌ TinyLlama-1.1B → ${PARAM_BILLIONS}B, expected 1.1"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 3: Parse Qwen/Qwen2.5-7B-Instruct ──
test_parse_qwen7b() {
    HF_REPO="Qwen/Qwen2.5-7B-Instruct"
    parse_hf_repo
    detect_param_count
    if [[ "$PARAM_BILLIONS" == "7" ]]; then
        echo "✅ Qwen2.5-7B → ${PARAM_BILLIONS}B"
        PASS=$((PASS+1))
    else
        echo "❌ Qwen2.5-7B → ${PARAM_BILLIONS}B, expected 7"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 4: Parse meta-llama/Llama-3.1-70B-Instruct ──
test_parse_llama70b() {
    HF_REPO="meta-llama/Llama-3.1-70B-Instruct"
    parse_hf_repo
    detect_param_count
    if [[ "$PARAM_BILLIONS" == "70" ]]; then
        echo "✅ Llama-3.1-70B → ${PARAM_BILLIONS}B"
        PASS=$((PASS+1))
    else
        echo "❌ Llama-3.1-70B → ${PARAM_BILLIONS}B, expected 70"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 5: ORG/REPO parsing ──
test_parse_org_repo() {
    HF_REPO="meta-llama/Llama-3.2-3B-Instruct"
    parse_hf_repo
    if [[ "$ORG" == "meta-llama" && "$REPO" == "Llama-3.2-3B-Instruct" ]]; then
        echo "✅ ORG=$ORG, REPO=$REPO"
        PASS=$((PASS+1))
    else
        echo "❌ ORG=$ORG, REPO=$REPO (expected meta-llama / Llama-3.2-3B-Instruct)"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 6: Parse microsoft/phi-2 (no B in name, uses known model fallback) ──
test_parse_phi2() {
    HF_REPO="microsoft/phi-2"
    parse_hf_repo
    detect_param_count
    if [[ "$PARAM_BILLIONS" == "2.7" ]]; then
        echo "✅ phi-2 → ${PARAM_BILLIONS}B (known model fallback)"
        PASS=$((PASS+1))
    else
        echo "❌ phi-2 → ${PARAM_BILLIONS}B, expected 2.7"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 7: Parse decimal params — mistralai/Mistral-7B-Instruct-v0.3 ──
test_parse_mistral7b() {
    HF_REPO="mistralai/Mistral-7B-Instruct-v0.3"
    parse_hf_repo
    detect_param_count
    if [[ "$PARAM_BILLIONS" == "7" ]]; then
        echo "✅ Mistral-7B → ${PARAM_BILLIONS}B"
        PASS=$((PASS+1))
    else
        echo "❌ Mistral-7B → ${PARAM_BILLIONS}B, expected 7"
        FAIL=$((FAIL+1))
    fi
}

# ── Run all tests ──
echo "══════════════════════════════════"
echo "  Model Parser Tests"
echo "══════════════════════════════════"
echo ""

test_parse_llama3b
test_parse_tinyllama
test_parse_qwen7b
test_parse_llama70b
test_parse_org_repo
test_parse_phi2
test_parse_mistral7b

echo ""
echo "──────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo "──────────────────────────────────"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
