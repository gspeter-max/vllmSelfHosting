import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeployPage from '@/app/deploy/page'
import { QUANTIZATION_OPTIONS } from '@/lib/constants'

// Mock the hooks and components
vi.mock('@/hooks/use-deploy', () => ({
    useDeploy: vi.fn(() => ({
        status: 'idle',
        logs: [],
        error: null,
        deploy: vi.fn(),
        reset: vi.fn(),
    })),
}))

vi.mock('@/components/dashboard/activity-log', () => ({
    addActivityEvent: vi.fn(),
}))

vi.mock('@/components/deploy/deploy-terminal', () => ({
    DeployTerminal: ({ modelName }: { modelName: string }) => (
        <div data-testid="deploy-terminal-mock">Terminal: {modelName}</div>
    ),
}))

import { useDeploy } from '@/hooks/use-deploy'

describe('DeployPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useDeploy).mockReturnValue({
            status: 'idle',
            deployId: null,
            logs: [],
            error: null,
            deploy: vi.fn(),
            reset: vi.fn(),
        })
    })

    it('renders all quantization option rows', () => {
        render(<DeployPage />)

        QUANTIZATION_OPTIONS.forEach((q) => {
            expect(screen.getByTestId(`quant-row-${q.name}`)).toBeInTheDocument()
        })
    })

    it('Q4_K_M is selected by default', () => {
        render(<DeployPage />)

        const row = screen.getByTestId('quant-row-Q4_K_M')
        expect(row).toHaveAttribute('aria-checked', 'true')
    })

    it('clicking a row selects it', async () => {
        const user = userEvent.setup()
        render(<DeployPage />)

        const q8Row = screen.getByTestId('quant-row-Q8_0')
        await user.click(q8Row)

        expect(q8Row).toHaveAttribute('aria-checked', 'true')

        // Q4_K_M should be deselected
        const q4Row = screen.getByTestId('quant-row-Q4_K_M')
        expect(q4Row).toHaveAttribute('aria-checked', 'false')
    })

    it('auto-select toggle dims the quantization table', async () => {
        const user = userEvent.setup()
        render(<DeployPage />)

        const toggle = screen.getByTestId('auto-select-toggle')
        await user.click(toggle)

        const table = screen.getByTestId('quant-table')
        expect(table.className).toContain('opacity-50')
    })

    it('deploy sends quantization when auto-select is OFF', async () => {
        const deployFn = vi.fn()
        vi.mocked(useDeploy).mockReturnValue({
            status: 'idle',
            deployId: null,
            logs: [],
            error: null,
            deploy: deployFn,
            reset: vi.fn(),
        })

        const user = userEvent.setup()
        render(<DeployPage />)

        // Type a model name
        const input = screen.getByTestId('model-input')
        await user.type(input, 'TinyLlama/TinyLlama-1.1B')

        // Click deploy
        const deployBtn = screen.getByTestId('deploy-btn')
        await user.click(deployBtn)

        expect(deployFn).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'cpu',
                model: 'TinyLlama/TinyLlama-1.1B',
                quantization: 'Q4_K_M',
            }),
        )
    })

    it('deploy omits quantization when auto-select is ON', async () => {
        const deployFn = vi.fn()
        vi.mocked(useDeploy).mockReturnValue({
            status: 'idle',
            deployId: null,
            logs: [],
            error: null,
            deploy: deployFn,
            reset: vi.fn(),
        })

        const user = userEvent.setup()
        render(<DeployPage />)

        // Toggle auto-select ON
        const toggle = screen.getByTestId('auto-select-toggle')
        await user.click(toggle)

        // Type model name and deploy
        const input = screen.getByTestId('model-input')
        await user.type(input, 'TinyLlama/TinyLlama-1.1B')

        const deployBtn = screen.getByTestId('deploy-btn')
        await user.click(deployBtn)

        expect(deployFn).toHaveBeenCalledWith(
            expect.objectContaining({
                quantization: undefined,
            }),
        )
    })

    it('deploy button is disabled when model is empty', () => {
        render(<DeployPage />)

        const deployBtn = screen.getByTestId('deploy-btn')
        expect(deployBtn).toBeDisabled()
    })

    it('deploy button is disabled during deployment', () => {
        vi.mocked(useDeploy).mockReturnValue({
            status: 'deploying',
            deployId: 'test-id',
            logs: [{ type: 'output', data: 'test', timestamp: Date.now() }],
            error: null,
            deploy: vi.fn(),
            reset: vi.fn(),
        })

        render(<DeployPage />)

        const deployBtn = screen.getByTestId('deploy-btn')
        expect(deployBtn).toBeDisabled()
    })
})
