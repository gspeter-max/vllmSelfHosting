import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

// Mock global fetch
global.fetch = vi.fn()

describe('Chat API Route', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('should route to Ollama by default (mode=cpu)', async () => {
        const req = new NextRequest('http://localhost:3000/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                model: 'llama2',
                message: 'Hello',
                mode: 'cpu',
            }),
        })

        // Mock Ollama response
        const mockStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(JSON.stringify({ message: { content: 'Hi' }, done: true })))
                controller.close()
            }
        })

            ; (global.fetch as any).mockResolvedValue({
                ok: true,
                body: mockStream,
            })

        await POST(req)

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('http://localhost:11434/api/chat'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"model":"llama2"'),
            })
        )
    })

    it('should route to vLLM (mode=gpu) with correct OpenAI format', async () => {
        const req = new NextRequest('http://localhost:3000/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                model: 'opt-125m',
                message: 'Hello GPU',
                mode: 'gpu',
                apiUrl: 'http://localhost:8000',
            }),
        })

        // Mock vLLM response
        const mockStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi GPU"}}]}\n\n'))
                controller.close()
            }
        })

            ; (global.fetch as any).mockResolvedValue({
                ok: true,
                body: mockStream,
            })

        await POST(req)

        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:8000/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"stream":true'),
            })
        )
    })
})
