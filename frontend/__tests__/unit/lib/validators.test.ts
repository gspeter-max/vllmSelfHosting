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
