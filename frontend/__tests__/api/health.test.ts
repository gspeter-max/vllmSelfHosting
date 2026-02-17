import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/health/route'

// Mock global fetch for health checks
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
    mockFetch.mockReset()
})

describe('GET /api/health', () => {
    it('reports Ollama healthy when reachable', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('11434')) {
                return Promise.resolve({
                    ok: true,
                    text: async () => 'Ollama is running',
                })
            }
            return Promise.reject(new Error('Connection refused'))
        })

        const response = await GET()
        const body = await response.json()

        expect(body.success).toBe(true)
        expect(body.data.ollama.status).toBe('healthy')
    })

    it('reports Ollama unhealthy when not reachable', async () => {
        mockFetch.mockRejectedValue(new Error('Connection refused'))

        const response = await GET()
        const body = await response.json()

        expect(body.success).toBe(true)
        expect(body.data.ollama.status).toBe('unhealthy')
    })

    it('reports mixed health states', async () => {
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('11434')) {
                return Promise.resolve({
                    ok: true,
                    text: async () => 'Ollama is running',
                })
            }
            return Promise.reject(new Error('Connection refused'))
        })

        const response = await GET()
        const body = await response.json()

        expect(body.data.ollama.status).toBe('healthy')
        expect(body.data.vllm.status).toBe('unhealthy')
    })
})
