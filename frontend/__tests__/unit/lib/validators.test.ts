import { describe, it, expect } from 'vitest'
import { deployRequestSchema, chatRequestSchema, modelNameParamSchema } from '@/lib/validators'

describe('deployRequestSchema', () => {
    it('accepts valid CPU deployment', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0',
            runMode: 'background',
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid GPU deployment', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'gpu',
            model: 'meta-llama/Llama-2-7b-chat-hf',
            gpuSlot: 0,
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid model name with shell characters', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'model; rm -rf /',
        })
        expect(result.success).toBe(false)
    })

    it('rejects missing fields', () => {
        const result = deployRequestSchema.safeParse({})
        expect(result.success).toBe(false)
    })

    it('rejects XSS attempt in model name', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: '<script>alert("xss")</script>',
        })
        expect(result.success).toBe(false)
    })

    // ── Quantization enum tests ──

    it('accepts valid quantization Q4_K_M', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'Q4_K_M',
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid quantization Q2_K (boundary)', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'Q2_K',
        })
        expect(result.success).toBe(true)
    })

    it('accepts valid quantization Q8_0 (boundary)', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'Q8_0',
        })
        expect(result.success).toBe(true)
    })

    it('accepts deploy without quantization (undefined)', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid quantization string', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'INVALID',
        })
        expect(result.success).toBe(false)
    })

    it('rejects quantization with injection characters', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'Q4_K_M; rm -rf /',
        })
        expect(result.success).toBe(false)
    })

    it('accepts CPU deploy with quantization and runMode', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'cpu',
            model: 'TinyLlama/TinyLlama-1.1B',
            quantization: 'Q5_K_M',
            runMode: 'foreground',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.quantization).toBe('Q5_K_M')
            expect(result.data.runMode).toBe('foreground')
        }
    })

    it('accepts GPU deploy with quantization (ignored by GPU)', () => {
        const result = deployRequestSchema.safeParse({
            mode: 'gpu',
            model: 'meta-llama/Llama-2-7b-chat-hf',
            gpuSlot: 1,
            quantization: 'Q4_K_M',
        })
        expect(result.success).toBe(true)
    })
})

describe('chatRequestSchema', () => {
    it('accepts valid chat request', () => {
        const result = chatRequestSchema.safeParse({
            model: 'tinyllama',
            message: 'Hello!',
        })
        expect(result.success).toBe(true)
    })

    it('accepts chat with conversation history', () => {
        const result = chatRequestSchema.safeParse({
            model: 'tinyllama',
            message: 'Follow up',
            conversationHistory: [
                { role: 'user', content: 'Hello!' },
                { role: 'assistant', content: 'Hi there!' },
            ],
        })
        expect(result.success).toBe(true)
    })

    it('rejects empty message', () => {
        const result = chatRequestSchema.safeParse({
            model: 'tinyllama',
            message: '',
        })
        expect(result.success).toBe(false)
    })
})

describe('modelNameParamSchema', () => {
    it('accepts valid model name', () => {
        const result = modelNameParamSchema.safeParse({ name: 'tinyllama:latest' })
        expect(result.success).toBe(true)
    })

    it('rejects empty model name', () => {
        const result = modelNameParamSchema.safeParse({ name: '' })
        expect(result.success).toBe(false)
    })
})
