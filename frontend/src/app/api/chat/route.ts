import { NextRequest, NextResponse } from 'next/server'
import { chatRequestSchema } from '@/lib/validators'
import { OLLAMA_API } from '@/lib/constants'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const parsed = chatRequestSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid chat request',
                    details: parsed.error.issues.map((i) => i.message),
                },
                { status: 400 },
            )
        }

        const { model, message, conversationHistory } = parsed.data

        // Build messages array
        const messages = [
            ...(conversationHistory || []),
            { role: 'user' as const, content: message },
        ]

        // Stream response from Ollama
        const ollamaRes = await fetch(OLLAMA_API.chat, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: true,
            }),
        })

        if (!ollamaRes.ok) {
            const text = await ollamaRes.text().catch(() => 'Unknown error')
            return NextResponse.json(
                { success: false, error: `Ollama error: ${text}` },
                { status: ollamaRes.status },
            )
        }

        if (!ollamaRes.body) {
            return NextResponse.json(
                { success: false, error: 'No response body from Ollama' },
                { status: 500 },
            )
        }

        // Proxy the stream from Ollama to the client
        const reader = ollamaRes.body.getReader()
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        const text = decoder.decode(value, { stream: true })
                        const lines = text.split('\n').filter(Boolean)

                        for (const line of lines) {
                            try {
                                const chunk = JSON.parse(line)
                                controller.enqueue(
                                    encoder.encode(
                                        `data: ${JSON.stringify({
                                            content: chunk.message?.content || '',
                                            done: chunk.done || false,
                                        })}\n\n`,
                                    ),
                                )
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }
                } catch (err) {
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({
                                error: err instanceof Error ? err.message : 'Stream error',
                                done: true,
                            })}\n\n`,
                        ),
                    )
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Chat request failed',
            },
            { status: 500 },
        )
    }
}
