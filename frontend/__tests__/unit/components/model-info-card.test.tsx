import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelInfoCard } from '@/components/deploy/model-info-card'
import type { HFModelInfo } from '@/lib/types'

const mockModel: HFModelInfo = {
    id: 'TheBloke/Llama-2-7B-Chat-GGUF',
    author: 'TheBloke',
    pipeline: 'text-generation',
    architecture: 'llama',
    parameters: 6738415616,
    parametersFormatted: '6.7B',
    contextLength: 4096,
    license: 'llama2',
    downloads: 91293,
    likes: 510,
    lastModified: '2023-10-14',
    tags: ['gguf', 'text-generation'],
    hasGguf: true,
    ggufFiles: [
        { filename: 'model.Q4_K_M.gguf', quantization: 'Q4_K_M', sizeBytes: 4081004224, bits: 4 },
    ],
}

describe('ModelInfoCard', () => {
    it('does not render when no data, not loading, and no error', () => {
        const { container } = render(
            <ModelInfoCard model={null} isLoading={false} error={null} />,
        )
        expect(container.innerHTML).toBe('')
    })

    it('shows loading skeleton when isLoading', () => {
        const { container } = render(
            <ModelInfoCard model={null} isLoading={true} error={null} />,
        )
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]')
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('shows error message when error is present', () => {
        render(
            <ModelInfoCard model={null} isLoading={false} error="Model not found" />,
        )
        expect(screen.getByText('Model not found')).toBeInTheDocument()
    })

    it('renders model name and author', () => {
        render(
            <ModelInfoCard model={mockModel} isLoading={false} error={null} />,
        )
        expect(screen.getByText('TheBloke/Llama-2-7B-Chat-GGUF')).toBeInTheDocument()
        expect(screen.getByText(/by TheBloke/)).toBeInTheDocument()
    })

    it('shows GGUF badge when hasGguf is true', () => {
        render(
            <ModelInfoCard model={mockModel} isLoading={false} error={null} />,
        )
        expect(screen.getByText('GGUF')).toBeInTheDocument()
    })

    it('does not show GGUF badge for non-GGUF models', () => {
        const nonGguf = { ...mockModel, hasGguf: false, ggufFiles: [] }
        render(
            <ModelInfoCard model={nonGguf} isLoading={false} error={null} />,
        )
        expect(screen.queryByText('GGUF')).not.toBeInTheDocument()
    })

    it('shows architecture info', () => {
        render(
            <ModelInfoCard model={mockModel} isLoading={false} error={null} />,
        )
        expect(screen.getByText('llama')).toBeInTheDocument()
    })

    it('shows formatted parameter count', () => {
        render(
            <ModelInfoCard model={mockModel} isLoading={false} error={null} />,
        )
        expect(screen.getByText('6.7B params')).toBeInTheDocument()
    })

    it('shows context length', () => {
        render(
            <ModelInfoCard model={mockModel} isLoading={false} error={null} />,
        )
        expect(screen.getByText('4,096 ctx')).toBeInTheDocument()
    })

    it('shows license', () => {
        render(
            <ModelInfoCard model={mockModel} isLoading={false} error={null} />,
        )
        expect(screen.getByText('llama2')).toBeInTheDocument()
    })

    it('shows download count formatted', () => {
        render(
            <ModelInfoCard model={mockModel} isLoading={false} error={null} />,
        )
        expect(screen.getByText('91.3k')).toBeInTheDocument()
    })

    it('handles model with no optional fields', () => {
        const minimal: HFModelInfo = {
            ...mockModel,
            architecture: null,
            parameters: null,
            parametersFormatted: null,
            contextLength: null,
            license: null,
        }
        const { container } = render(
            <ModelInfoCard model={minimal} isLoading={false} error={null} />,
        )
        // Should render without crashing
        expect(container).toBeTruthy()
        expect(screen.getByText('TheBloke/Llama-2-7B-Chat-GGUF')).toBeInTheDocument()
    })
})
