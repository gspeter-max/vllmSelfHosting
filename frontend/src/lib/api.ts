import { API_ROUTES } from './constants'
import type {
    Model,
    ModelDetails,
    DeployRequest,
    DeployResponse,
    SystemInfo,
    HealthStatus,
    ApiResponse,
} from './types'

// ============================================================
// API Client — typed fetch wrappers for all API routes
// ============================================================

class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options)
    if (!res.ok) {
        const body = await res.text().catch(() => 'Unknown error')
        throw new ApiError(res.status, body)
    }
    return res.json()
}

// ---- Deploy ----

export async function startDeploy(request: DeployRequest): Promise<DeployResponse> {
    return fetchJson<DeployResponse>(API_ROUTES.deploy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    })
}

// ---- Models ----

export async function getModels(): Promise<Model[]> {
    const res = await fetchJson<ApiResponse<Model[]>>(API_ROUTES.models)
    return res.data ?? []
}

export async function getModelDetails(name: string): Promise<ModelDetails> {
    return fetchJson<ModelDetails>(API_ROUTES.model(name))
}

export async function deleteModel(name: string): Promise<void> {
    await fetchJson<ApiResponse<null>>(API_ROUTES.model(name), {
        method: 'DELETE',
    })
}

export async function startModel(name: string): Promise<void> {
    await fetchJson<ApiResponse<null>>(API_ROUTES.modelStart(name), {
        method: 'POST',
    })
}

export async function stopModel(name: string): Promise<void> {
    await fetchJson<ApiResponse<null>>(API_ROUTES.modelStop(name), {
        method: 'POST',
    })
}

// ---- System ----

export async function getSystemInfo(): Promise<SystemInfo> {
    const res = await fetchJson<ApiResponse<SystemInfo>>(API_ROUTES.system)
    return res.data!
}

export async function getHealthStatus(): Promise<HealthStatus> {
    const res = await fetchJson<ApiResponse<HealthStatus>>(API_ROUTES.health)
    return res.data!
}

export { ApiError }
