import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SystemOverview } from '@/components/system/system-overview'
import type { SystemInfo, HealthStatus } from '@/lib/types'

const mockSystemInfo: SystemInfo = {
    os: 'macOS 14.0',
    arch: 'x64',
    cpu: 'Intel Core i7-9750H',
    cpuCores: 12,
    cpuLoad: 25,
    ramTotal: '16.0 GB',
    ramTotalBytes: 17179869184,
    ramAvailable: '8.0 GB',
    ramAvailableBytes: 8589934592,
    ramUsed: '8.0 GB',
    ramUsedBytes: 8589934592,
    hostname: 'test-mac',
    gpu: null,
    vllmKvCachePercent: null,
}

const mockHealthStatus: HealthStatus = {
    ollama: { status: 'healthy', message: 'Ollama is running', url: 'http://localhost:11434' },
    vllm: { status: 'unhealthy', message: 'vLLM is not running', url: 'http://localhost:8104' },
}

describe('SystemOverview', () => {
    it('renders system info correctly', () => {
        render(
            <SystemOverview
                systemInfo={mockSystemInfo}
                healthStatus={mockHealthStatus}
                isLoading={false}
            />,
        )

        expect(screen.getByText('macOS 14.0')).toBeInTheDocument()
        expect(screen.getByText('Intel Core i7-9750H')).toBeInTheDocument()
        expect(screen.getByText(/12 cores/)).toBeInTheDocument()
        expect(screen.getByText('16.0 GB')).toBeInTheDocument()
    })

    it('shows loading skeletons when loading', () => {
        const { container } = render(
            <SystemOverview
                systemInfo={null}
                healthStatus={null}
                isLoading={true}
            />,
        )

        // Skeletons are rendered as animated divs
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows correct OS icon section', () => {
        render(
            <SystemOverview
                systemInfo={mockSystemInfo}
                healthStatus={mockHealthStatus}
                isLoading={false}
            />,
        )

        expect(screen.getByText('Operating System')).toBeInTheDocument()
        expect(screen.getByText(/x64/)).toBeInTheDocument()
    })
})
