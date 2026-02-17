#!/bin/bash
# test/test_system_detect.sh — Unit tests for OS, RAM, CPU, cores detection
#
# Sources deploy_cpu.sh with TESTING=1 to access functions without running main()

set +e
export TESTING=1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../deploy_cpu.sh"

PASS=0
FAIL=0

# ── Test 1: detect_os returns valid value ──
test_detect_os() {
    local result
    result=$(detect_os)
    if [[ "$result" =~ ^(macos|linux|wsl|windows|unknown)$ ]]; then
        echo "✅ detect_os → '$result'"
        PASS=$((PASS+1))
    else
        echo "❌ detect_os → unexpected '$result'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 2: detect_ram_gb returns number > 0 ──
test_detect_ram() {
    local os result
    os=$(detect_os)
    result=$(detect_ram_gb "$os")
    if [[ "$result" -gt 0 ]] 2>/dev/null; then
        echo "✅ detect_ram_gb → ${result}GB"
        PASS=$((PASS+1))
    else
        echo "❌ detect_ram_gb → '$result' (expected > 0)"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 3: detect_available_ram_gb returns number > 0 ──
test_detect_available_ram() {
    local os result
    os=$(detect_os)
    result=$(detect_available_ram_gb "$os")
    if [[ "$result" -gt 0 ]] 2>/dev/null; then
        echo "✅ detect_available_ram_gb → ${result}GB"
        PASS=$((PASS+1))
    else
        echo "❌ detect_available_ram_gb → '$result' (expected > 0)"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 4: detect_cpu returns valid type ──
test_detect_cpu() {
    local os result
    os=$(detect_os)
    result=$(detect_cpu "$os")
    if [[ "$result" =~ ^(apple_silicon|intel|amd)$ ]]; then
        echo "✅ detect_cpu → '$result'"
        PASS=$((PASS+1))
    else
        echo "❌ detect_cpu → unexpected '$result'"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 5: detect_cores returns number > 0 ──
test_detect_cores() {
    local os result
    os=$(detect_os)
    result=$(detect_cores "$os")
    if [[ "$result" -gt 0 ]] 2>/dev/null; then
        echo "✅ detect_cores → $result"
        PASS=$((PASS+1))
    else
        echo "❌ detect_cores → '$result' (expected > 0)"
        FAIL=$((FAIL+1))
    fi
}

# ── Test 6: total RAM >= available RAM ──
test_ram_consistency() {
    local os total avail
    os=$(detect_os)
    total=$(detect_ram_gb "$os")
    avail=$(detect_available_ram_gb "$os")
    if [[ "$total" -ge "$avail" ]] 2>/dev/null; then
        echo "✅ RAM consistency → total(${total}GB) >= available(${avail}GB)"
        PASS=$((PASS+1))
    else
        echo "❌ RAM consistency → total(${total}GB) < available(${avail}GB)"
        FAIL=$((FAIL+1))
    fi
}

# ── Run all tests ──
echo "══════════════════════════════════"
echo "  System Detection Tests"
echo "══════════════════════════════════"
echo ""

test_detect_os
test_detect_ram
test_detect_available_ram
test_detect_cpu
test_detect_cores
test_ram_consistency

echo ""
echo "──────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo "──────────────────────────────────"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
