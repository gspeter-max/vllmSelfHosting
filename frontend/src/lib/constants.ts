// ============================================================
// Shared constants for the vLLM Self-Hosting Dashboard
// ============================================================

/** Ollama API base URL */
export const OLLAMA_BASE_URL = 'http://localhost:11434'

/** Ollama API endpoints */
export const OLLAMA_API = {
    tags: `${OLLAMA_BASE_URL}/api/tags`,
    show: `${OLLAMA_BASE_URL}/api/show`,
    chat: `${OLLAMA_BASE_URL}/api/chat`,
    delete: `${OLLAMA_BASE_URL}/api/delete`,
    pull: `${OLLAMA_BASE_URL}/api/pull`,
    running: `${OLLAMA_BASE_URL}/api/ps`,
} as const

/** vLLM default ports by GPU slot */
export const VLLM_PORTS: Record<number, number> = {
    0: 8104,
    1: 8105,
}

/** Get vLLM base URL for a GPU slot */
export const getVllmBaseUrl = (gpuSlot: number): string =>
    `http://localhost:${VLLM_PORTS[gpuSlot] ?? 8104}`

/** Internal API routes */
export const API_ROUTES = {
    deploy: '/api/deploy',
    deployStream: '/api/deploy/stream',
    models: '/api/models',
    model: (name: string) => `/api/models/${encodeURIComponent(name)}`,
    modelStart: (name: string) => `/api/models/${encodeURIComponent(name)}/start`,
    modelStop: (name: string) => `/api/models/${encodeURIComponent(name)}/stop`,
    chat: '/api/chat',
    system: '/api/system',
    health: '/api/health',
} as const

/** Navigation items for sidebar */
export const NAV_ITEMS = [
    { title: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
    { title: 'Deploy', href: '/deploy', icon: 'Rocket' },
    { title: 'Models', href: '/models', icon: 'Box' },
    { title: 'Chat', href: '/chat', icon: 'MessageSquare' },
    { title: 'System', href: '/system', icon: 'Monitor' },
] as const

/** Polling intervals (ms) */
export const POLL_INTERVAL = {
    models: 10000,
    health: 15000,
    system: 30000,
} as const

/** Quantization options for CPU deployment */
export const QUANTIZATION_OPTIONS = [
    { name: 'Q2_K', bits: 2, size: '~2GB', description: 'Smallest, lowest quality', recommended: false, minRam: 4 },
    { name: 'Q4_0', bits: 4, size: '~4GB', description: 'Small, decent quality', recommended: false, minRam: 6 },
    { name: 'Q4_K_M', bits: 4, size: '~4.5GB', description: 'Balanced quality and size', recommended: true, minRam: 8 },
    { name: 'Q5_K_M', bits: 5, size: '~5.5GB', description: 'Good quality', recommended: false, minRam: 10 },
    { name: 'Q6_K', bits: 6, size: '~6.5GB', description: 'High quality', recommended: false, minRam: 12 },
    { name: 'Q8_0', bits: 8, size: '~8GB', description: 'Near-original quality', recommended: false, minRam: 14 },
] as const

/** Chat localStorage key */
export const CHAT_STORAGE_KEY = 'vllm-dashboard-conversations'

/** Activity log localStorage key */
export const ACTIVITY_STORAGE_KEY = 'vllm-dashboard-activity'

/** Max activity log entries */
export const MAX_ACTIVITY_ENTRIES = 50
