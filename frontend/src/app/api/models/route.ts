import { NextResponse } from 'next/server'
import { OLLAMA_API } from '@/lib/constants'
import type { Model } from '@/lib/types'

export async function GET() {
    try {
        const models: Model[] = []

        // Query Ollama for CPU models
        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            const res = await fetch(OLLAMA_API.tags, { signal: controller.signal })
            clearTimeout(timeout)

            if (res.ok) {
                const data = await res.json()
                const ollamaModels = data.models || []

                // Check which models are currently running
                let runningModels: string[] = []
                try {
                    const psRes = await fetch(OLLAMA_API.running)
                    if (psRes.ok) {
                        const psData = await psRes.json()
                        runningModels = (psData.models || []).map((m: { name: string }) => m.name)
                    }
                } catch {
                    // Can't get running status
                }

                for (const m of ollamaModels) {
                    const isRunning = runningModels.some((r) => r === m.name || m.name.startsWith(r.split(':')[0]))
                    models.push({
                        name: m.name,
                        displayName: m.name.split(':')[0],
                        type: 'cpu',
                        status: isRunning ? 'running' : 'stopped',
                        size: m.size ? formatSize(m.size) : undefined,
                        quantization: m.details?.quantization_level,
                        port: 11434,
                        apiUrl: `http://localhost:11434/api/chat`,
                        apiUrlOpenAI: `http://localhost:11434/v1/chat/completions`,
                        modifiedAt: m.modified_at,
                        digest: m.digest,
                    })
                }
            }
        } catch {
            // Ollama not running
        }

        return NextResponse.json({ success: true, data: models })
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to list models' },
            { status: 500 },
        )
    }
}

function formatSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(0)} MB`
}
