import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getModels, getSystemInfo, getHealthStatus, startDeploy, deleteModel, ApiError } from '@/lib/api'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
    mockFetch.mockReset()
})

describe('getModels', () => {
    it('returns model list on success', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: [
                    { name: 'tinyllama', type: 'cpu', status: 'running', port: 11434 },
                ],
            }),
        })
        const models = await getModels()
        expect(models).toHaveLength(1)
        expect(models[0].name).toBe('tinyllama')
    })

    it('returns empty array when no data', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
        })
        const models = await getModels()
        expect(models).toEqual([])
    })

    it('throws ApiError on non-OK response', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error',
        })
        await expect(getModels()).rejects.toThrow(ApiError)
    })

    it('handles network failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))
        await expect(getModels()).rejects.toThrow('Network error')
    })
})

describe('startDeploy', () => {
    it('sends POST request with body', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ deployId: 'abc123', status: 'started' }),
        })
        const result = await startDeploy({
            mode: 'cpu',
            model: 'tinyllama',
        })
        expect(result.deployId).toBe('abc123')
        expect(mockFetch).toHaveBeenCalledWith('/api/deploy', expect.objectContaining({
            method: 'POST',
        }))
    })
})

describe('deleteModel', () => {
    it('sends DELETE request', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
        })
        await deleteModel('tinyllama')
        expect(mockFetch).toHaveBeenCalledWith(
            '/api/models/tinyllama',
            expect.objectContaining({ method: 'DELETE' })
        )
    })
})

describe('getSystemInfo', () => {
    it('returns system info', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    os: 'macOS',
                    cpu: 'Intel Core i7',
                    cpuCores: 12,
                    ramTotal: '16 GB',
                    ramTotalBytes: 17179869184,
                    ramAvailable: '8 GB',
                    ramAvailableBytes: 8589934592,
                    ramUsed: '8 GB',
                    ramUsedBytes: 8589934592,
                    arch: 'x86_64',
                },
            }),
        })
        const info = await getSystemInfo()
        expect(info.os).toBe('macOS')
        expect(info.cpuCores).toBe(12)
    })
})
