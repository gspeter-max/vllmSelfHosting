import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeployTerminal } from '@/components/deploy/deploy-terminal'
import type { DeployEvent } from '@/lib/types'

let writeTextSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
    vi.clearAllMocks()
    // Ensure clipboard exists then spy on writeText
    if (!navigator.clipboard) {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            writable: true,
            configurable: true,
        })
    }
    writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
})

const makeLogs = (lines: string[]): DeployEvent[] =>
    lines.map((data, i) => ({
        type: 'output' as const,
        data,
        timestamp: Date.now() + i,
    }))

describe('DeployTerminal', () => {
    it('renders log lines', () => {
        const logs = makeLogs(['Line 1', 'Line 2', 'Line 3'])
        render(<DeployTerminal logs={logs} status="deploying" modelName="test-model" />)

        expect(screen.getByText('Line 1')).toBeInTheDocument()
        expect(screen.getByText('Line 2')).toBeInTheDocument()
        expect(screen.getByText('Line 3')).toBeInTheDocument()
    })

    it('shows line numbers', () => {
        const logs = makeLogs(['First', 'Second'])
        render(<DeployTerminal logs={logs} status="deploying" modelName="test-model" />)

        const numbers = screen.getAllByTestId('line-number')
        expect(numbers).toHaveLength(2)
        expect(numbers[0]).toHaveTextContent('1')
        expect(numbers[1]).toHaveTextContent('2')
    })

    it('displays model name in title bar', () => {
        render(<DeployTerminal logs={[]} status="deploying" modelName="TinyLlama/TinyLlama-1.1B" />)

        expect(screen.getByTestId('terminal-model-name')).toHaveTextContent(
            'Deployment — TinyLlama/TinyLlama-1.1B',
        )
    })

    it('shows Running badge when deploying', () => {
        render(<DeployTerminal logs={[]} status="deploying" modelName="test" />)

        const badge = screen.getByTestId('terminal-status-badge')
        expect(badge).toHaveTextContent('Running')
    })

    it('shows Complete badge when completed', () => {
        const logs = makeLogs(['Done'])
        render(<DeployTerminal logs={logs} status="completed" modelName="test" />)

        const badge = screen.getByTestId('terminal-status-badge')
        expect(badge).toHaveTextContent('Complete')
    })

    it('shows Failed badge when failed', () => {
        const logs = makeLogs(['Error'])
        render(<DeployTerminal logs={logs} status="failed" modelName="test" />)

        const badge = screen.getByTestId('terminal-status-badge')
        expect(badge).toHaveTextContent('Failed')
    })

    it('copy button copies logs to clipboard', async () => {
        // Setup clipboard mock before render
        const writeTextFn = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextFn },
            writable: true,
            configurable: true,
        })

        const { fireEvent } = await import('@testing-library/react')
        const logs = makeLogs(['Line A', 'Line B'])
        render(<DeployTerminal logs={logs} status="completed" modelName="test" />)

        const copyBtn = screen.getByTestId('terminal-copy-btn')
        fireEvent.click(copyBtn)

        // Allow async clipboard call + setState to complete
        await new Promise((r) => setTimeout(r, 100))

        expect(writeTextFn).toHaveBeenCalledWith('Line A\nLine B')
    })

    it('renders without crashing with empty logs', () => {
        render(<DeployTerminal logs={[]} status="deploying" modelName="test" />)

        expect(screen.getByTestId('deploy-terminal')).toBeInTheDocument()
        expect(screen.getByText('Waiting for output...')).toBeInTheDocument()
    })
})
