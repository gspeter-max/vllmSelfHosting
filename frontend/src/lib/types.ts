// ============================================================
// Core types for the vLLM Self-Hosting Dashboard
// ============================================================

/** Deployment mode: CPU via Ollama or GPU via vLLM */
export type DeployMode = 'cpu' | 'gpu'

/** Model runtime status */
export type ModelStatus = 'running' | 'stopped' | 'error' | 'loading'

/** GPU slot options */
export type GpuSlot = 0 | 1

/** Chat message role */
export type MessageRole = 'user' | 'assistant' | 'system'

// ============================================================
// Model types
// ============================================================

export interface Model {
    name: string
    displayName: string
    type: DeployMode
    status: ModelStatus
    size?: string
    quantization?: string
    port: number
    apiUrl: string
    apiUrlOpenAI?: string
    modifiedAt?: string
    digest?: string
    gpuSlot?: GpuSlot
}

export interface ModelDetails {
    name: string
    type: DeployMode
    status: ModelStatus
    size?: string
    quantization?: string
    port: number
    apiUrl: string
    apiUrlOpenAI?: string
    family?: string
    parameterSize?: string
    gpuSlot?: GpuSlot
}

// ============================================================
// Deploy types
// ============================================================

export interface DeployRequest {
    mode: DeployMode
    model: string
    quantization?: string
    runMode?: 'background' | 'foreground'
    gpuSlot?: GpuSlot
}

export interface DeployResponse {
    deployId: string
    status: 'started' | 'error'
    message?: string
}

export interface DeployEvent {
    type: 'output' | 'error' | 'status' | 'complete'
    data: string
    timestamp: number
}

// ============================================================
// Chat types
// ============================================================

export interface ChatMessage {
    id: string
    role: MessageRole
    content: string
    timestamp: number
    model?: string
}

export interface ChatRequest {
    model: string
    messages: { role: MessageRole; content: string }[]
    stream?: boolean
}

export interface Conversation {
    id: string
    title: string
    model: string
    messages: ChatMessage[]
    createdAt: number
    updatedAt: number
}

// ============================================================
// System types
// ============================================================

export interface GpuInfo {
    name: string
    vramTotalMB: number
    vramUsedMB: number
    vramFreeMB: number
    utilization: number
    temperature: number
}

export interface SystemInfo {
    os: string
    osVersion?: string
    arch: string
    cpu: string
    cpuCores: number
    cpuLoad: number
    ramTotal: string
    ramTotalBytes: number
    ramAvailable: string
    ramAvailableBytes: number
    ramUsed: string
    ramUsedBytes: number
    hostname?: string
    gpu: GpuInfo | null
    vllmKvCachePercent: number | null
}

export interface HealthStatus {
    ollama: ServiceHealth
    vllm: ServiceHealth
}

export interface ServiceHealth {
    status: 'healthy' | 'unhealthy' | 'not_installed'
    version?: string
    message?: string
    url?: string
}

// ============================================================
// Activity log types
// ============================================================

export interface ActivityEvent {
    id: string
    type: 'deploy' | 'start' | 'stop' | 'remove' | 'error'
    model: string
    message: string
    timestamp: number
}

// ============================================================
// API response wrapper
// ============================================================

export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: string
}

// ============================================================
// Quantization types (for CPU deploy)
// ============================================================

export interface QuantizationOption {
    name: string
    bits: number
    size: string
    description: string
    recommended: boolean
    minRam: number
}
