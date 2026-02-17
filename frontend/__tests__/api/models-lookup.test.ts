import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/models/lookup/route'

// Mock global fetch to avoid real HTTP calls
const originalFetch = global.fetch

beforeEach(() => {
    vi.clearAllMocks()
})

afterAll(() => {
    global.fetch = originalFetch
})

function createRequest(url: string): NextRequest {
    return new NextRequest(new URL(url, 'http://localhost:3000'))
}

const MOCK_GGUF_RESPONSE = {
    id: 'TheBloke/Llama-2-7B-Chat-GGUF',
    author: 'TheBloke',
    pipeline_tag: 'text-generation',
    downloads: 91293,
    likes: 510,
    lastModified: '2023-10-14T21:36:33.000Z',
    tags: ['transformers', 'gguf', 'llama', 'text-generation'],
    config: { model_type: 'llama' },
    cardData: { license: 'llama2' },
    gguf: { total: 6738415616, architecture: 'llama', context_length: 4096 },
    siblings: [
        { rfilename: 'README.md' },
        { rfilename: 'llama-2-7b-chat.Q2_K.gguf', lfs: { size: 2825940672 } },
        { rfilename: 'llama-2-7b-chat.Q4_K_M.gguf', lfs: { size: 4081004224 } },
        { rfilename: 'llama-2-7b-chat.Q8_0.gguf', lfs: { size: 7161089728 } },
    ],
}

const MOCK_BASE_RESPONSE = {
    id: 'microsoft/phi-2',
    author: 'microsoft',
    pipeline_tag: 'text-generation',
    downloads: 1429784,
    likes: 3425,
    lastModified: '2025-12-08T11:35:44.000Z',
    tags: ['transformers', 'safetensors', 'phi', 'text-generation'],
    config: { architectures: ['PhiForCausalLM'], model_type: 'phi' },
    cardData: { license: 'mit' },
    safetensors: { parameters: { F16: 2779683840 } },
    siblings: [
        { rfilename: 'README.md' },
        { rfilename: 'model-00001-of-00002.safetensors' },
    ],
}

describe('GET /api/models/lookup', () => {
    it('returns 400 for missing repo param', async () => {
        const req = createRequest('/api/models/lookup')
        const res = await GET(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.success).toBe(false)
        expect(body.error).toContain('Missing or invalid')
    })

    it('returns 400 for invalid repo format (no slash)', async () => {
        const req = createRequest('/api/models/lookup?repo=justname')
        const res = await GET(req)
        expect(res.status).toBe(400)
    })

    it('parses GGUF repo correctly', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(MOCK_GGUF_RESPONSE),
        })

        const req = createRequest('/api/models/lookup?repo=TheBloke/Llama-2-7B-Chat-GGUF')
        const res = await GET(req)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.data.id).toBe('TheBloke/Llama-2-7B-Chat-GGUF')
        expect(body.data.hasGguf).toBe(true)
        expect(body.data.ggufFiles).toHaveLength(3) // Only .gguf files
        expect(body.data.architecture).toBe('llama')
        expect(body.data.contextLength).toBe(4096)
        expect(body.data.parameters).toBe(6738415616)
        expect(body.data.license).toBe('llama2')
    })

    it('extracts quantization from GGUF filenames', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(MOCK_GGUF_RESPONSE),
        })

        const req = createRequest('/api/models/lookup?repo=TheBloke/Llama-2-7B-Chat-GGUF')
        const res = await GET(req)
        const body = await res.json()

        const quants = body.data.ggufFiles.map((f: { quantization: string }) => f.quantization)
        expect(quants).toContain('Q2_K')
        expect(quants).toContain('Q4_K_M')
        expect(quants).toContain('Q8_0')
    })

    it('returns file sizes for GGUF files', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(MOCK_GGUF_RESPONSE),
        })

        const req = createRequest('/api/models/lookup?repo=TheBloke/Llama-2-7B-Chat-GGUF')
        const res = await GET(req)
        const body = await res.json()

        const q4 = body.data.ggufFiles.find((f: { quantization: string }) => f.quantization === 'Q4_K_M')
        expect(q4.sizeBytes).toBe(4081004224)
    })

    it('parses base model (non-GGUF) correctly', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(MOCK_BASE_RESPONSE),
        })

        const req = createRequest('/api/models/lookup?repo=microsoft/phi-2')
        const res = await GET(req)
        const body = await res.json()

        expect(body.success).toBe(true)
        expect(body.data.hasGguf).toBe(false)
        expect(body.data.ggufFiles).toHaveLength(0)
        expect(body.data.architecture).toBe('PhiForCausalLM')
        expect(body.data.parameters).toBe(2779683840)
        expect(body.data.parametersFormatted).toBe('2.8B')
        expect(body.data.license).toBe('mit')
    })

    it('handles HF API 404', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        })

        const req = createRequest('/api/models/lookup?repo=nonexistent/model-xxx')
        const res = await GET(req)
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(body.error).toContain('not found')
    })

    it('handles fetch timeout/error', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('timeout'))

        const req = createRequest('/api/models/lookup?repo=org/model')
        const res = await GET(req)
        expect(res.status).toBe(502)
        const body = await res.json()
        expect(body.error).toBe('timeout')
    })
})
