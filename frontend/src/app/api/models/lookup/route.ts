import { NextRequest, NextResponse } from 'next/server'

// In-memory cache: repo → { data, timestamp }
const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Known quantization bit-widths by prefix */
const QUANT_BITS: Record<string, number> = {
    Q2: 2, Q3: 3, Q4: 4, Q5: 5, Q6: 6, Q8: 8, F16: 16, F32: 32,
    IQ1: 1, IQ2: 2, IQ3: 3, IQ4: 4,
}

function parseBits(quant: string): number {
    const prefix = quant.split('_')[0]
    return QUANT_BITS[prefix] ?? 0
}

function parseQuantFromFilename(filename: string): string | null {
    // Match patterns like model.Q4_K_M.gguf or model-Q4_0.gguf
    const match = filename.match(/[.\-]((?:Q|F|IQ)\d[\w]*?)\.gguf$/i)
    return match ? match[1] : null
}

function formatParams(params: number): string {
    if (params >= 1e12) return `${(params / 1e12).toFixed(1)}T`
    if (params >= 1e9) return `${(params / 1e9).toFixed(1)}B`
    if (params >= 1e6) return `${(params / 1e6).toFixed(0)}M`
    return String(params)
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest) {
    const repo = req.nextUrl.searchParams.get('repo')
    if (!repo || !repo.includes('/')) {
        return NextResponse.json(
            { success: false, error: 'Missing or invalid repo parameter (expected org/name)' },
            { status: 400 },
        )
    }

    // Check cache
    const cached = cache.get(repo)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return NextResponse.json({ success: true, data: cached.data })
    }

    try {
        const res = await fetch(`https://huggingface.co/api/models/${repo}`, {
            signal: AbortSignal.timeout(8000),
            headers: { Accept: 'application/json' },
        })

        if (!res.ok) {
            const status = res.status
            const msg = status === 404 ? `Model "${repo}" not found on HuggingFace` : `HuggingFace API error (${status})`
            return NextResponse.json({ success: false, error: msg }, { status })
        }

        const raw: any = await res.json()

        // Extract GGUF files from siblings
        const siblings: any[] = raw.siblings ?? []
        const ggufFiles = siblings
            .filter((s: any) => typeof s.rfilename === 'string' && s.rfilename.endsWith('.gguf'))
            .map((s: any) => {
                const quant = parseQuantFromFilename(s.rfilename)
                return {
                    filename: s.rfilename,
                    quantization: quant ?? s.rfilename,
                    sizeBytes: s.lfs?.size ?? s.size ?? 0,
                    bits: quant ? parseBits(quant) : 0,
                }
            })
            .sort((a: any, b: any) => a.bits - b.bits || a.sizeBytes - b.sizeBytes)

        // Extract parameters count
        let parameters: number | null = null
        if (raw.safetensors?.parameters) {
            const params = raw.safetensors.parameters
            // Take F16 or the first key value
            parameters = params.F16 ?? params.BF16 ?? Object.values(params)[0] ?? null
        }
        if (!parameters && raw.gguf?.total) {
            parameters = raw.gguf.total
        }

        // Extract architecture
        let architecture: string | null = null
        if (raw.config?.architectures?.[0]) {
            architecture = raw.config.architectures[0]
        } else if (raw.config?.model_type) {
            architecture = raw.config.model_type
        } else if (raw.gguf?.architecture) {
            architecture = raw.gguf.architecture
        }

        const data = {
            id: raw.id ?? repo,
            author: raw.author ?? repo.split('/')[0],
            pipeline: raw.pipeline_tag ?? 'unknown',
            architecture,
            parameters,
            parametersFormatted: parameters ? formatParams(parameters) : null,
            contextLength: raw.gguf?.context_length ?? null,
            license: raw.cardData?.license ?? null,
            downloads: raw.downloads ?? 0,
            likes: raw.likes ?? 0,
            lastModified: raw.lastModified ?? null,
            tags: raw.tags ?? [],
            hasGguf: ggufFiles.length > 0,
            ggufFiles,
        }

        // Cache it
        cache.set(repo, { data, ts: Date.now() })

        return NextResponse.json({ success: true, data })
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to fetch model info'
        return NextResponse.json({ success: false, error: msg }, { status: 502 })
    }
}
