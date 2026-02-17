import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useModelLookup } from '@/hooks/use-model-lookup'

const mockModelInfo = {
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
    tags: ['gguf'],
    hasGguf: true,
    ggufFiles: [
        { filename: 'llama-2-7b-chat.Q4_K_M.gguf', quantization: 'Q4_K_M', sizeBytes: 4081004224, bits: 4 },
    ],
}

const originalFetch = global.fetch

describe('useModelLookup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        global.fetch = originalFetch
    })

    it('does not fetch for empty string', async () => {
        const fetchSpy = vi.fn()
        global.fetch = fetchSpy

        renderHook(() => useModelLookup(''))

        // Wait a bit past debounce
        await new Promise((r) => setTimeout(r, 600))
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does not fetch for invalid format (no slash)', async () => {
        const fetchSpy = vi.fn()
        global.fetch = fetchSpy

        renderHook(() => useModelLookup('justname'))

        await new Promise((r) => setTimeout(r, 600))
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('does not fetch for format with multiple slashes', async () => {
        const fetchSpy = vi.fn()
        global.fetch = fetchSpy

        renderHook(() => useModelLookup('a/b/c'))

        await new Promise((r) => setTimeout(r, 600))
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('sets isLoading when valid repo is entered', () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, data: mockModelInfo }),
        })

        const { result } = renderHook(() => useModelLookup('org/model'))
        expect(result.current.isLoading).toBe(true)
    })

    it('fetches after debounce delay for valid repo', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, data: mockModelInfo }),
        })

        renderHook(() => useModelLookup('TheBloke/Llama-2-7B-Chat-GGUF'))

        // Wait for debounce + fetch
        await waitFor(
            () => {
                expect(global.fetch).toHaveBeenCalledTimes(1)
            },
            { timeout: 2000 },
        )
    })

    it('returns data on successful fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, data: mockModelInfo }),
        })

        const { result } = renderHook(() => useModelLookup('TheBloke/Llama-2-7B-Chat-GGUF'))

        await waitFor(
            () => {
                expect(result.current.data).not.toBeNull()
            },
            { timeout: 2000 },
        )

        expect(result.current.data?.id).toBe('TheBloke/Llama-2-7B-Chat-GGUF')
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('returns error on failed fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: false, error: 'Model not found' }),
        })

        const { result } = renderHook(() => useModelLookup('org/bad-model'))

        await waitFor(
            () => {
                expect(result.current.error).toBe('Model not found')
            },
            { timeout: 2000 },
        )

        expect(result.current.data).toBeNull()
        expect(result.current.isLoading).toBe(false)
    })

    it('clears state when input becomes invalid', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, data: mockModelInfo }),
        })

        const { result, rerender } = renderHook(
            ({ repo }: { repo: string }) => useModelLookup(repo),
            { initialProps: { repo: 'org/model' } },
        )

        await waitFor(
            () => {
                expect(result.current.data).not.toBeNull()
            },
            { timeout: 2000 },
        )

        // Change to invalid
        rerender({ repo: 'invalid' })
        expect(result.current.data).toBeNull()
        expect(result.current.error).toBeNull()
    })
})
