import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSystemInfo } from '@/hooks/use-system-info'

// Mock the api module
vi.mock('@/lib/api', () => ({
    getSystemInfo: vi.fn(),
}))

import { getSystemInfo } from '@/lib/api'
const mockGetSystemInfo = vi.mocked(getSystemInfo)

const mockData = {
    os: 'macOS 14.0',
    arch: 'arm64',
    cpu: 'Apple M1',
    cpuCores: 8,
    cpuLoad: 25,
    ramTotal: '16.0 GB',
    ramTotalBytes: 16 * 1024 ** 3,
    ramAvailable: '8.0 GB',
    ramAvailableBytes: 8 * 1024 ** 3,
    ramUsed: '8.0 GB',
    ramUsedBytes: 8 * 1024 ** 3,
    gpu: null,
    vllmKvCachePercent: null,
}

describe('useSystemInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetSystemInfo.mockResolvedValue(mockData as never)
    })

    it('returns initial loading state', () => {
        const { result } = renderHook(() => useSystemInfo(60000)) // Long interval to avoid extra calls
        expect(result.current.isLoading).toBe(true)
        expect(result.current.data).toBeNull()
    })

    it('fetches data on mount', async () => {
        const { result } = renderHook(() => useSystemInfo(60000))

        await waitFor(() => {
            expect(result.current.data).not.toBeNull()
        })

        expect(mockGetSystemInfo).toHaveBeenCalledTimes(1)
        expect(result.current.data?.os).toBe('macOS 14.0')
        expect(result.current.isLoading).toBe(false)
    })

    it('builds history with each fetch', async () => {
        const { result } = renderHook(() => useSystemInfo(60000))

        await waitFor(() => {
            expect(result.current.history.length).toBe(1)
        })
    })

    it('history snapshot has correct shape', async () => {
        const { result } = renderHook(() => useSystemInfo(60000))

        await waitFor(() => {
            expect(result.current.history.length).toBe(1)
        })

        const snap = result.current.history[0]
        expect(snap).toHaveProperty('timestamp')
        expect(snap).toHaveProperty('ramUsedGB')
        expect(snap).toHaveProperty('ramTotalGB')
        expect(snap).toHaveProperty('cpuLoad')
        expect(snap.ramTotalGB).toBeCloseTo(16, 0)
    })

    it('handles fetch errors gracefully', async () => {
        mockGetSystemInfo.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useSystemInfo(60000))

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false)
        })

        expect(result.current.error).toBe('Network error')
        expect(result.current.data).toBeNull()
    })

    it('returns refetch function', async () => {
        const { result } = renderHook(() => useSystemInfo(60000))

        await waitFor(() => {
            expect(result.current.data).not.toBeNull()
        })

        expect(typeof result.current.refetch).toBe('function')
    })

    it('cleans up interval on unmount', async () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
        const { result, unmount } = renderHook(() => useSystemInfo(60000))

        await waitFor(() => {
            expect(result.current.data).not.toBeNull()
        })

        unmount()
        expect(clearIntervalSpy).toHaveBeenCalled()
        clearIntervalSpy.mockRestore()
    })
})
