#!/bin/bash
# test/test_quant_calculator.sh — Unit tests for RAM calculator & quant picker
#
# Sources deploy_cpu.sh with TESTING=1 to access functions without running main()

set +e
export TESTING=1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../deploy_cpu.sh"

PASS=0
FAIL=0

# ── Test 1: calc_ram 7B × Q4_K_M → ~5.2GB ──
test_calc_7b_q4() {
    local result
    result=$(calc_ram 7 "Q4_K_M")
    # Expected: 7 × 0.60 + 1.0 = 5.2
    if (( $(echo "$result > 5.0 && $result < 5.5" | bc -l) )); then
        echo "✅ calc_ram(7B, Q4_K_M) → ${result}GB"
        PASS=$((PASS+1))
    else
        echo "❌ calc_ram(7B, Q4_K_M) → ${result}GB, expected ~5.2"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 2: calc_ram 1B × Q8_0 → ~2.1GB ──
test_calc_1b_q8() {
    local result
    result=$(calc_ram 1 "Q8_0")
    # Expected: 1 × 1.10 + 1.0 = 2.1
    if (( $(echo "$result > 1.9 && $result < 2.3" | bc -l) )); then
        echo "✅ calc_ram(1B, Q8_0) → ${result}GB"
        PASS=$((PASS+1))
    else
        echo "❌ calc_ram(1B, Q8_0) → ${result}GB, expected ~2.1"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 3: calc_ram 70B × Q2_K → ~29.0GB ──
test_calc_70b_q2() {
    local result
    result=$(calc_ram 70 "Q2_K")
    # Expected: 70 × 0.40 + 1.0 = 29.0
    if (( $(echo "$result > 28.5 && $result < 30.0" | bc -l) )); then
        echo "✅ calc_ram(70B, Q2_K) → ${result}GB"
        PASS=$((PASS+1))
    else
        echo "❌ calc_ram(70B, Q2_K) → ${result}GB, expected ~29.0"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 4: calc_ram 3B × Q5_K_M → ~3.25GB ──
test_calc_3b_q5() {
    local result
    result=$(calc_ram 3 "Q5_K_M")
    # Expected: 3 × 0.75 + 1.0 = 3.25
    if (( $(echo "$result > 3.0 && $result < 3.5" | bc -l) )); then
        echo "✅ calc_ram(3B, Q5_K_M) → ${result}GB"
        PASS=$((PASS+1))
    else
        echo "❌ calc_ram(3B, Q5_K_M) → ${result}GB, expected ~3.25"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 5: pick_best_quant 7B with 10GB budget → Q5_K_M or Q4_K_M ──
test_pick_quant_7b_10gb() {
    local result
    result=$(pick_best_quant 7 10)
    if [[ "$result" == "Q5_K_M" || "$result" == "Q4_K_M" ]]; then
        echo "✅ pick_best_quant(7B, 10GB) → $result"
        PASS=$((PASS+1))
    else
        echo "❌ pick_best_quant(7B, 10GB) → $result, expected Q4_K_M or Q5_K_M"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 6: pick_best_quant 70B with 10GB → Q2_K (smallest, nothing really fits) ──
test_pick_quant_70b_10gb() {
    local result
    result=$(pick_best_quant 70 10)
    if [[ "$result" == "Q2_K" ]]; then
        echo "✅ pick_best_quant(70B, 10GB) → $result (correct: too big)"
        PASS=$((PASS+1))
    else
        echo "❌ pick_best_quant(70B, 10GB) → $result, expected Q2_K"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 7: pick_best_quant 1B with 16GB → Q8_0 (highest quality fits easily) ──
test_pick_quant_1b_16gb() {
    local result
    result=$(pick_best_quant 1 16)
    if [[ "$result" == "Q8_0" ]]; then
        echo "✅ pick_best_quant(1B, 16GB) → $result (highest quality)"
        PASS=$((PASS+1))
    else
        echo "❌ pick_best_quant(1B, 16GB) → $result, expected Q8_0"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 8: pick_best_quant 3B with 3GB → Q2_K (tight budget) ──
test_pick_quant_3b_3gb() {
    local result
    result=$(pick_best_quant 3 3)
    if [[ "$result" == "Q2_K" || "$result" == "Q3_K_M" ]]; then
        echo "✅ pick_best_quant(3B, 3GB) → $result (tight budget)"
        PASS=$((PASS+1))
    else
        echo "❌ pick_best_quant(3B, 3GB) → $result, expected Q2_K or Q3_K_M"
        FAIL=$((FAIL+1))
    fi
}

# ── Run all tests ──
echo "══════════════════════════════════"
echo "  Quantization Calculator Tests"
echo "══════════════════════════════════"
echo ""

test_calc_7b_q4
test_calc_1b_q8
test_calc_70b_q2
test_calc_3b_q5
test_pick_quant_7b_10gb
test_pick_quant_70b_10gb
test_pick_quant_1b_16gb
test_pick_quant_3b_3gb

echo ""
echo "──────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo "──────────────────────────────────"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
