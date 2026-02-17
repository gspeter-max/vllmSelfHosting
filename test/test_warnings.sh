#!/bin/bash
# test/test_warnings.sh — Unit tests for warning threshold levels
#
# Sources deploy_cpu.sh with TESTING=1 to access functions without running main()

set +e
export TESTING=1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../deploy_cpu.sh"

PASS=0
FAIL=0

# ── Test 1: 30% usage → none ──
test_warn_30pct() {
    local result
    result=$(get_warn_level 3.0 10.0)   # 30%
    if [[ "$result" == "none" ]]; then
        echo "✅ 30% → none"
        PASS=$((PASS+1))
    else
        echo "❌ 30% → '$result', expected 'none'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 2: 40% usage → none (boundary) ──
test_warn_40pct() {
    local result
    result=$(get_warn_level 4.0 10.0)   # 40%
    if [[ "$result" == "none" ]]; then
        echo "✅ 40% → none (boundary)"
        PASS=$((PASS+1))
    else
        echo "❌ 40% → '$result', expected 'none'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 3: 50% usage → info ──
test_warn_50pct() {
    local result
    result=$(get_warn_level 5.0 10.0)   # 50%
    if [[ "$result" == "info" ]]; then
        echo "✅ 50% → info"
        PASS=$((PASS+1))
    else
        echo "❌ 50% → '$result', expected 'info'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 4: 60% usage → info (boundary) ──
test_warn_60pct() {
    local result
    result=$(get_warn_level 6.0 10.0)   # 60%
    if [[ "$result" == "info" ]]; then
        echo "✅ 60% → info (boundary)"
        PASS=$((PASS+1))
    else
        echo "❌ 60% → '$result', expected 'info'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 5: 75% usage → warning ──
test_warn_75pct() {
    local result
    result=$(get_warn_level 7.5 10.0)   # 75%
    if [[ "$result" == "warning" ]]; then
        echo "✅ 75% → warning"
        PASS=$((PASS+1))
    else
        echo "❌ 75% → '$result', expected 'warning'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 6: 80% usage → warning (boundary) ──
test_warn_80pct() {
    local result
    result=$(get_warn_level 8.0 10.0)   # 80%
    if [[ "$result" == "warning" ]]; then
        echo "✅ 80% → warning (boundary)"
        PASS=$((PASS+1))
    else
        echo "❌ 80% → '$result', expected 'warning'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 7: 90% usage → danger ──
test_warn_90pct() {
    local result
    result=$(get_warn_level 9.0 10.0)   # 90%
    if [[ "$result" == "danger" ]]; then
        echo "✅ 90% → danger"
        PASS=$((PASS+1))
    else
        echo "❌ 90% → '$result', expected 'danger'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 8: 95% usage → danger (boundary) ──
test_warn_95pct() {
    local result
    result=$(get_warn_level 9.5 10.0)   # 95%
    if [[ "$result" == "danger" ]]; then
        echo "✅ 95% → danger (boundary)"
        PASS=$((PASS+1))
    else
        echo "❌ 95% → '$result', expected 'danger'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 9: 98% usage → refuse ──
test_warn_98pct() {
    local result
    result=$(get_warn_level 9.8 10.0)   # 98%
    if [[ "$result" == "refuse" ]]; then
        echo "✅ 98% → refuse"
        PASS=$((PASS+1))
    else
        echo "❌ 98% → '$result', expected 'refuse'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 10: 10% usage → none (very low) ──
test_warn_10pct() {
    local result
    result=$(get_warn_level 1.0 10.0)   # 10%
    if [[ "$result" == "none" ]]; then
        echo "✅ 10% → none"
        PASS=$((PASS+1))
    else
        echo "❌ 10% → '$result', expected 'none'"
        FAIL=$((FAIL+1))
    fi
}

# ── Run all tests ──
echo "══════════════════════════════════"
echo "  Warning Threshold Tests"
echo "══════════════════════════════════"
echo ""

test_warn_10pct
test_warn_30pct
test_warn_40pct
test_warn_50pct
test_warn_60pct
test_warn_75pct
test_warn_80pct
test_warn_90pct
test_warn_95pct
test_warn_98pct

echo ""
echo "──────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo "──────────────────────────────────"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
