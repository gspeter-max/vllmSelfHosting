#!/bin/bash

# Test script for start.sh logic
# We will source the script but mock the execution of docker compose

# Mock docker command
docker() {
    if [[ "$1" == "info" ]]; then
        return 0
    elif [[ "$1" == "compose" ]]; then
        echo "MOCK_DOCKER_EXEC: docker compose $@"
        return 0
    fi
    return 0
}
export -f docker

# Mock uname
uname() {
    if [[ "$1" == "-s" ]]; then
        echo "$MOCK_OS"
    elif [[ "$1" == "-m" ]]; then
        echo "$MOCK_ARCH"
    fi
}
export -f uname

# Test Case 1: macOS Apple Silicon
export MOCK_OS="Darwin"
export MOCK_ARCH="arm64"
echo "TEST 1: macOS Apple Silicon"
OUTPUT=$(./start.sh 2>&1)
if echo "$OUTPUT" | grep -q "docker-compose.mac.yml"; then
    echo "PASS: Detected macOS and included mac config"
else
    echo "FAIL: Did not include mac config. Output:"
    echo "$OUTPUT"
fi

# Test Case 2: Linux Nvidia
export MOCK_OS="Linux"
export MOCK_ARCH="x86_64"
# Mock nvidia-smi existence by creating a function
nvidia-smi() { return 0; }
export -f nvidia-smi

echo "TEST 2: Linux Nvidia"
OUTPUT=$(./start.sh 2>&1)
if echo "$OUTPUT" | grep -q "docker-compose.nvidia.yml"; then
    echo "PASS: Detected Nvidia and included nvidia config"
else
    echo "FAIL: Did not include nvidia config. Output:"
    echo "$OUTPUT"
fi

# Test Case 3: Linux CPU
unset -f nvidia-smi
echo "TEST 3: Linux CPU"
OUTPUT=$(./start.sh 2>&1)
if echo "$OUTPUT" | grep -q "nvidia" || echo "$OUTPUT" | grep -q "mac"; then
    echo "FAIL: Included extra config for CPU"
else
    echo "PASS: CPU mode only"
fi
