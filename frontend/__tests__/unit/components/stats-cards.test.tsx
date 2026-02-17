import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsCards } from '@/components/dashboard/stats-cards'
import type { Model, SystemInfo, HealthStatus } from '@/lib/types'

const mockModels: Model[] = [
    {
        name: 'tinyllama',
        displayName: 'TinyLlama',
        type: 'cpu',
        status: 'running',
        port: 11434,
        apiUrl: 'http://localhost:11434/api/chat',
    },
    {
        name: 'llama2',
        displayName: 'Llama 2',
        type: 'gpu',
        status: 'stopped',
        port: 8104,
        apiUrl: 'http://localhost:8104/v1/chat/completions',
    },
]

const mockSystemInfo: SystemInfo = {
    os: 'macOS 14.0',
    arch: 'x64',
    cpu: 'Intel i7',
    cpuCores: 12,
    ramTotal: '16.0 GB',
    ramTotalBytes: 17179869184,
    ramAvailable: '8.0 GB',
    ramAvailableBytes: 8589934592,
    ramUsed: '8.0 GB',
    ramUsedBytes: 8589934592,
}

const mockHealth: HealthStatus = {
    ollama: { status: 'healthy', message: 'Ollama running', url: 'http://localhost:11434' },
    vllm: { status: 'unhealthy', message: 'Not running', url: 'http://localhost:8104' },
}

describe('StatsCards', () => {
    it('renders all 4 stats', () => {
        render(
            <StatsCards
                models={mockModels}
                systemInfo={mockSystemInfo}
                healthStatus={mockHealth}
                isLoading={false}
            />,
        )

        expect(screen.getByText('Models Deployed')).toBeInTheDocument()
        expect(screen.getByText('Models Running')).toBeInTheDocument()
        expect(screen.getByText('RAM Usage')).toBeInTheDocument()
        expect(screen.getByText('Mode')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument() // 2 models
        expect(screen.getByText('1')).toBeInTheDocument() // 1 running
    })

    it('shows loading skeleton', () => {
        const { container } = render(
            <StatsCards
                models={[]}
                systemInfo={null}
                healthStatus={null}
                isLoading={true}
            />,
        )

        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('handles zero state', () => {
        render(
            <StatsCards
                models={[]}
                systemInfo={mockSystemInfo}
                healthStatus={mockHealth}
                isLoading={false}
            />,
        )

        const zeros = screen.getAllByText('0')
        expect(zeros.length).toBe(2) // Models Deployed and Models Running
        expect(screen.getByText('No models deployed')).toBeInTheDocument()
    })
})
