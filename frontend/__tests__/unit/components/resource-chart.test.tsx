import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SystemSnapshot } from '@/hooks/use-system-info'
import type { SystemInfo } from '@/lib/types'

// Mock recharts to avoid JSDOM SVG rendering issues
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    Tooltip: () => <div data-testid="tooltip" />,
    CartesianGrid: () => <div data-testid="grid" />,
}))

import { ResourceChart } from '@/components/system/resource-chart'

const makeHistory = (count: number): SystemSnapshot[] =>
    Array.from({ length: count }, (_, i) => ({
        timestamp: Date.now() - (count - i) * 2000,
        ramUsedGB: 8 + Math.random(),
        ramTotalGB: 16,
        cpuLoad: 25 + Math.random() * 10,
        vramUsedMB: null,
        vramTotalMB: null,
        gpuUtil: null,
    }))

const makeGpuHistory = (count: number): SystemSnapshot[] =>
    Array.from({ length: count }, (_, i) => ({
        timestamp: Date.now() - (count - i) * 2000,
        ramUsedGB: 10,
        ramTotalGB: 16,
        cpuLoad: 30,
        vramUsedMB: 4000,
        vramTotalMB: 8000,
        gpuUtil: 55,
    }))

const baseSysInfo: SystemInfo = {
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

describe('ResourceChart', () => {
    it('renders RAM chart title', () => {
        render(
            <ResourceChart
                history={makeHistory(5)}
                systemInfo={baseSysInfo}
                isLoading={false}
            />,
        )
        expect(screen.getByText(/RAM/)).toBeInTheDocument()
    })

    it('renders CPU chart title', () => {
        render(
            <ResourceChart
                history={makeHistory(5)}
                systemInfo={baseSysInfo}
                isLoading={false}
            />,
        )
        expect(screen.getByText(/CPU/)).toBeInTheDocument()
    })

    it('does not show GPU chart when no GPU data', () => {
        render(
            <ResourceChart
                history={makeHistory(5)}
                systemInfo={baseSysInfo}
                isLoading={false}
            />,
        )
        // GPU section should not render
        const gpuElements = screen.queryAllByText(/GPU/)
        expect(gpuElements.length).toBe(0)
    })

    it('shows GPU chart when GPU data is present', () => {
        const gpuSysInfo: SystemInfo = {
            ...baseSysInfo,
            gpu: {
                name: 'NVIDIA RTX 3090',
                vramTotalMB: 8000,
                vramUsedMB: 4000,
                vramFreeMB: 4000,
                utilization: 55,
                temperature: 65,
            },
        }
        render(
            <ResourceChart
                history={makeGpuHistory(5)}
                systemInfo={gpuSysInfo}
                isLoading={false}
            />,
        )
        expect(screen.getByText(/GPU/)).toBeInTheDocument()
    })

    it('shows loading skeleton when in loading state', () => {
        const { container } = render(
            <ResourceChart
                history={[]}
                systemInfo={null}
                isLoading={true}
            />,
        )
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('handles empty history gracefully', () => {
        const { container } = render(
            <ResourceChart
                history={[]}
                systemInfo={baseSysInfo}
                isLoading={false}
            />,
        )
        expect(container).toBeTruthy()
    })
})
