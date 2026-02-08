# vLLM Self-Hosting Scripts

Collection of automation scripts for deploying and managing LLM models with vLLM inference server.

## 📁 Overview

This repository contains scripts to:
- Download models from HuggingFace
- Deploy to single GPU with automatic configuration
- Run multiple parallel agents for scaling
- Manage systemd services
- Auto-configure LiteLLM and nginx

---

## 🚀 Quick Start

### Basic Deployment (Single GPU)

```bash
# Deploy to GPU 0 (Port 8104)
./deploy_model.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0 0

# Deploy to GPU 1 (Port 8105)
./deploy_model.sh meta-llama/Llama-3.2-1B-Instruct 1
```

---

## 📜 deploy_model.sh

**Location**: `/Users/apple/project/vllmSelfHosting/deploy_model.sh`

### Features

| Feature | Description |
|---------|-------------|
| 🔄 **Auto-Unload** | Stops existing service on GPU slot before deploying |
| 📥 **Fast Download** | Uses `hf` CLI for fastest HuggingFace downloads |
| 🎯 **Auto-Detection** | Detects model size and adjusts parameters |
| 🔧 **Systemd Service** | Creates and enables systemd service automatically |
| 🌐 **LiteLLM Integration** | Updates LiteLLM config for API gateway routing |
| 🔀 **nginx Proxy** | Configures nginx reverse proxy |
| ✅ **4-Level Testing** | Tests vLLM, nginx, LiteLLM, and inference |
| 📝 **Auto-Documentation** | Generates README for each deployed model |

### GPU Slot Configuration

| GPU | Port | Memory Util | Max Tokens | Max Seqs | Use Case |
|-----|------|-------------|------------|----------|----------|
| 0 | 8104 | 80% | 16,000 | 64 | Large models (7B+) |
| 1 | 8105 | 30% | 4,096 | 256 | Small models (<3B) |

### What It Does

```
Input: HuggingFace repo + GPU ID
  ↓
1. Parse model name & generate service name
  ↓
2. Stop existing service on GPU slot
  ↓
3. Download model from HuggingFace
  ↓
4. Detect model size & adjust parameters
  ↓
5. Create systemd service
  ↓
6. Update LiteLLM config
  ↓
7. Generate README.md
  ↓
8. Start service & wait for load
  ↓
9. Run 4-level tests
  ↓
10. Reload nginx + LiteLLM
  ↓
Success! Model deployed
```

### Usage Examples

```bash
# Small model on GPU 1
./deploy_model.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0 1

# Medium model on GPU 0
./deploy_model.sh Qwen/Qwen2.5-7B-Instruct 0

# Large model on GPU 0
./deploy_model.sh meta-llama/Llama-3.1-8B-Instruct 0
```

---

## 🔧 Requirements

- **OS**: Linux (systemd required)
- **GPU**: NVIDIA with CUDA support
- **Python**: 3.10+
- **vLLM**: Installed at `/data/vllm/vllm-native/.venv`
- **HuggingFace Token**: For private models

---

## 📁 Directory Structure

After deployment:

```
/data/models/
├── {org}/
│   └── {model-name}/
│       ├── model/              # Downloaded model files
│       │   ├── config.json
│       │   ├── *.safetensors
│       │   └── ...
│       ├── logs/               # Service logs
│       │   └── {service}.log
│       ├── .cache/             # HuggingFace cache
│       ├── .env                # Environment variables
│       └── README.md           # Auto-generated docs
```

---

## 🧪 Testing Levels

The script runs 4 levels of tests:

1. **vLLM Direct**: `http://127.0.0.1:{port}/v1/models`
2. **nginx Proxy**: `http://192.168.50.103/{location}/v1/models`
3. **LiteLLM Routing**: Via API gateway
4. **Inference**: Actual chat completion test

---

## 🌐 Access URLs

After successful deployment:

| Method | URL |
|--------|-----|
| **Direct vLLM** | `http://192.168.50.103:{port}/v1` |
| **nginx Proxy** | `http://192.168.50.103/{service-name}/v1` |
| **LiteLLM API** | `http://192.168.50.103/v1/chat/completions` |

### Example Request

```bash
curl -X POST http://192.168.50.103/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LITELLM_KEY" \
  -d '{
    "model": "model-name",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

---

## 🛠️ Service Management

```bash
# Check status
sudo systemctl status {service-name}

# View logs (real-time)
tail -f /data/models/{org}/{model-name}/logs/{service-name}.log

# Restart service
sudo systemctl restart {service-name}

# Stop service
sudo systemctl stop {service-name}

# Disable auto-start
sudo systemctl disable {service-name}
```

---

## 🔄 Auto-Unload Feature

When deploying to a GPU slot, the script automatically:

1. Detects existing service on that GPU
2. Stops the old service
3. Disables it from auto-start
4. Backs up LiteLLM config
5. Proceeds with new deployment

**Example**: If GPU 0 has `qwen-7b-instruct` running:
```bash
./deploy_model.sh llama-3-8b 0
# → Stops qwen-7b-instruct
# → Deploys llama-3-8b
# → Both don't run simultaneously
```

---

## 📊 Model Size Detection

The script automatically adjusts parameters based on model size:

| Params | GPU Memory | Max Len | Max Seqs |
|--------|------------|---------|----------|
| < 2B | 20% | 2,048 | 512 |
| 2-4B | 30% | 4,096 | 256 |
| 4-10B | 60% | 8,192 | 128 |
| > 10B | 80% | 16,000 | 64 |

---

## 🐛 Troubleshooting

### Model Won't Load

```bash
# Check GPU memory
nvidia-smi

# View service logs
sudo journalctl -u {service-name} -f

# Check model files
ls -la /data/models/{org}/{model-name}/model
```

### Tests Fail

1. **vLLM Direct Failed**: Model not loaded - check logs
2. **nginx Failed**: nginx config issue - restart docker
3. **LiteLLM Failed**: Config not updated - check YAML
4. **Inference Failed**: Model issue - check vLLM logs

### Port Already in Use

```bash
# Find what's using the port
sudo lsof -i :8104

# Stop the conflicting service
sudo systemctl stop {conflicting-service}
```

---

## 📝 Auto-Generated README

Each deployed model gets its own README at:
```
/data/models/{org}/{model-name}/README.md
```

Contains:
- Model information
- Deployment date
- Access URLs
- Service management commands
- Configuration details

---

## 🔐 Security Notes & Environment Variables

The script requires these environment variables to be set:

```bash
# Required for downloading models from HuggingFace
export HF_TOKEN="your_huggingface_token_here"

# Required for LiteLLM API authentication
export LITELLM_KEY="your_litellm_key_here"
```

### Setting Environment Variables

**Temporary (current session only):**
```bash
export HF_TOKEN="hf_..."
export LITELLM_KEY="sk-..."
./deploy_model.sh model/repo 0
```

**Permanent (add to ~/.bashrc or ~/.zshrc):**
```bash
echo 'export HF_TOKEN="hf_..."' >> ~/.bashrc
echo 'export LITELLM_KEY="sk-..."' >> ~/.bashrc
source ~/.bashrc
```

**Using .env file:**
```bash
# Create .env file in project directory
echo "HF_TOKEN=hf_..." > .env
echo "LITELLM_KEY=sk-..." >> .env

# Source before running
source .env
./deploy_model.sh model/repo 0
```

---

## 📦 Dependencies Installed

The script automatically installs:
- `huggingface-hub` - For model downloads
- `PyYAML` - For config file editing

---

## 🚀 Advanced Usage

### Deploy Multiple Models

```bash
# GPU 0: Large model
./deploy_model.sh meta-llama/Llama-3.1-8B-Instruct 0

# GPU 1: Small model
./deploy_model.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0 1
```

### Switch Models on Same GPU

```bash
# First deployment
./deploy_model.sh qwen-7b 0

# Replace with new model (auto-unloads qwen-7b)
./deploy_model.sh llama-3-8b 0
```

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📞 Support

For issues or questions:
- Check the troubleshooting section
- Review service logs
- Verify GPU availability
- Test components individually

---

**Last Updated**: 2025-02-08
