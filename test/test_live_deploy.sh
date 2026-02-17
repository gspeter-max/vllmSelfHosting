#!/bin/bash
# test/test_live_deploy.sh — Live integration test
#
# Deploys smollm:135m (92MB), tests API endpoints, and cleans up.
# Safe on any system — the model is tiny.
#
# Prerequisites: Ollama must be installed (this test won't auto-install it)

set -e

TEST_MODEL="smollm:135m"

echo "═══════════════════════════════════════"
echo "  LIVE INTEGRATION TEST"
echo "═══════════════════════════════════════"
echo "  Model: $TEST_MODEL (92MB)"
echo ""

PASS=0
FAIL=0

# ── Step 1: Verify Ollama is installed ──
echo -n "1. Ollama installed... "
if command -v ollama &>/dev/null; then
    echo "✅"
    ((PASS++))
else
    echo "❌ (ollama not found — install it first)"
    exit 1
fi

# ── Step 2: Ensure Ollama service is running ──
echo -n "2. Ollama service running... "
if ! curl -sf http://localhost:11434/api/tags &>/dev/null; then
    # Try starting it
    ollama serve &>/dev/null &
    sleep 3
fi

if curl -sf http://localhost:11434/api/tags &>/dev/null; then
    echo "✅"
    ((PASS++))
else
    echo "❌ (could not start Ollama — try 'ollama serve' manually)"
    exit 1
fi

# ── Step 3: Pull model ──
echo "3. Pulling $TEST_MODEL..."
if ollama pull "$TEST_MODEL"; then
    echo "   ✅ Pulled"
    ((PASS++))
else
    echo "   ❌ Failed to pull"
    ((FAIL++))
    exit 1
fi

# ── Step 4: Verify model is listed ──
echo -n "4. Model in list... "
if ollama list | grep -qi "smollm"; then
    echo "✅"
    ((PASS++))
else
    echo "❌"
    ((FAIL++))
fi

# ── Step 5: Inference test (Ollama native API) ──
echo -n "5. Inference test... "
RESPONSE=$(curl -sf -X POST http://localhost:11434/api/generate \
    -d '{"model": "smollm:135m", "prompt": "Say hi", "stream": false}' 2>/dev/null || echo "")

if echo "$RESPONSE" | grep -q "response"; then
    echo "✅"
    ((PASS++))
else
    echo "❌"
    ((FAIL++))
fi

# ── Step 6: OpenAI-compatible endpoint ──
echo -n "6. OpenAI API test... "
RESPONSE=$(curl -sf -X POST http://localhost:11434/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model": "smollm:135m", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5}' 2>/dev/null || echo "")

if echo "$RESPONSE" | grep -q "choices"; then
    echo "✅"
    ((PASS++))
else
    echo "❌"
    ((FAIL++))
fi

# ── Cleanup ──
echo ""
echo -n "Cleaning up... "
ollama rm "$TEST_MODEL" &>/dev/null || true
echo "✅"

# ── Results ──
echo ""
echo "═══════════════════════════════════════"
if [[ $FAIL -eq 0 ]]; then
    echo "  ✅ ALL ${PASS} LIVE TESTS PASSED"
else
    echo "  ❌ ${FAIL} test(s) failed, ${PASS} passed"
fi
echo "═══════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
