#!/bin/bash
# test/run_all_tests.sh — Runs all unit test suites and reports results

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════"
echo "  Running All Unit Tests"
echo "═══════════════════════════════════════"

TOTAL_PASS=0
TOTAL_FAIL=0

for test_file in test_system_detect.sh test_quant_calculator.sh \
                 test_model_parser.sh test_warnings.sh; do
    echo ""
    echo "── ${test_file} ──"
    if bash "${SCRIPT_DIR}/${test_file}"; then
        ((TOTAL_PASS++))
    else
        ((TOTAL_FAIL++))
    fi
done

echo ""
echo "═══════════════════════════════════════"
if [[ $TOTAL_FAIL -eq 0 ]]; then
    echo "  ✅ ALL SUITES PASSED ($TOTAL_PASS/$((TOTAL_PASS + TOTAL_FAIL)))"
else
    echo "  ❌ FAILURES: $TOTAL_FAIL suite(s) failed ($TOTAL_PASS passed)"
fi
echo "═══════════════════════════════════════"
[[ $TOTAL_FAIL -eq 0 ]] && exit 0 || exit 1
