import { NextResponse } from 'next/server'
import { OLLAMA_BASE_URL, VLLM_PORTS } from '@/lib/constants'

async function checkService(
    url: string,
    name: string,
): Promise<{
    status: 'healthy' | 'unhealthy' | 'not_installed'
    version?: string
    message?: string
    url: string
}> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeout)

        if (res.ok) {
            let version: string | undefined
            try {
                const text = await res.text()
                // Ollama returns version string like "Ollama is running"
                if (text.includes('Ollama')) {
                    version = text.trim()
                }
            } catch {
                // ignore parse errors
            }
            return { status: 'healthy', version, message: `${name} is running`, url }
        }
        return { status: 'unhealthy', message: `${name} returned ${res.status}`, url }
    } catch (error) {
        const msg =
            error instanceof Error && error.name === 'AbortError'
                ? `${name} connection timed out`
                : `${name} is not running`
        return { status: 'unhealthy', message: msg, url }
    }
}

export async function GET() {
    try {
        // Check Ollama
        const ollama = await checkService(OLLAMA_BASE_URL, 'Ollama')

        // Check vLLM on both GPU slots
        const vllmChecks = await Promise.all(
            Object.entries(VLLM_PORTS).map(([slot, port]) =>
                checkService(`http://localhost:${port}/health`, `vLLM GPU ${slot}`),
            ),
        )

        // vLLM is healthy if at least one GPU slot is responding
        const healthyVllm = vllmChecks.find((v) => v.status === 'healthy')
        const vllm = healthyVllm ?? {
            status: 'unhealthy' as const,
            message: 'No vLLM instances running',
            url: `http://localhost:${VLLM_PORTS[0]}`,
        }

        return NextResponse.json({
            success: true,
            data: {
                ollama,
                vllm,
            },
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error:
                    error instanceof Error ? error.message : 'Failed to check health',
            },
            { status: 500 },
        )
    }
}
