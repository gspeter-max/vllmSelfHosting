// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from '../../../src/app/api/system/route'

// Mock child_process and os
vi.mock('child_process', () => ({
    exec: vi.fn(),
}))
vi.mock('os', () => ({
    default: {
        platform: vi.fn(),
        arch: vi.fn().mockReturnValue('arm64'),
        cpus: vi.fn().mockReturnValue([{ model: 'Apple M1' }]),
        totalmem: vi.fn().mockReturnValue(16 * 1024 * 1024 * 1024),
        loadavg: vi.fn().mockReturnValue([1.5, 1.2, 1.0]),
        freemem: vi.fn().mockReturnValue(8 * 1024 * 1024 * 1024),
        hostname: vi.fn().mockReturnValue('test-host'),
    },
}))
vi.mock('util', () => ({
    promisify: (fn: any) => fn,
}))

import { exec } from 'child_process'
import os from 'os'

describe('System API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should detect AMD GPU on macOS correctly', async () => {
        // Setup mocks
        vi.mocked(os.platform).mockReturnValue('darwin')

        const mockSystemProfiler = JSON.stringify({
            SPDisplaysDataType: [
                {
                    sppci_model: "Intel UHD Graphics 630",
                    spdisplays_vram_shared: "1536 MB"
                },
                {
                    sppci_model: "AMD Radeon Pro 5300M",
                    spdisplays_vram: "4 GB"
                }
            ]
        })

        vi.mocked(exec).mockImplementation((cmd: string, opts: any) => {
            if (cmd.includes('system_profiler')) {
                return Promise.resolve({ stdout: mockSystemProfiler }) as any
            }
            if (cmd.includes('vm_stat')) return Promise.resolve({ stdout: '' }) as any
            if (cmd.includes('sw_vers')) return Promise.resolve({ stdout: '14.0' }) as any
            return Promise.resolve({ stdout: '' }) as any
        })

        const response = await GET()
        const json = await response.json()

        expect(json.success).toBe(true)
        expect(json.data.gpu).toEqual({
            name: "AMD Radeon Pro 5300M",
            vramTotalMB: 4096, // 4 GB * 1024
            vramUsedMB: 0,
            vramFreeMB: 0,
            utilization: 0,
            temperature: 0
        })
    })

    it('should fallback to Intel if no AMD/Apple GPU found', async () => {
        // Setup mocks
        vi.mocked(os.platform).mockReturnValue('darwin')

        const mockSystemProfiler = JSON.stringify({
            SPDisplaysDataType: [
                {
                    sppci_model: "Intel UHD Graphics 630",
                    spdisplays_vram_shared: "1536 MB"
                }
            ]
        })

        vi.mocked(exec).mockImplementation((cmd: string, opts: any) => {
            if (cmd.includes('system_profiler')) {
                return Promise.resolve({ stdout: mockSystemProfiler }) as any
            }
            return Promise.resolve({ stdout: '' }) as any
        })

        const response = await GET()
        const json = await response.json()

        expect(json.success).toBe(true)
        expect(json.data.gpu.name).toBe("Intel UHD Graphics 630")
    })
})
