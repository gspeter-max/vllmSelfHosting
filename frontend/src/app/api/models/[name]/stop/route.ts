import { NextRequest, NextResponse } from 'next/server'
import { OLLAMA_BASE_URL } from '@/lib/constants'

interface RouteParams {
    params: Promise<{ name: string }>
}

// POST /api/models/[name]/stop — Unload model from memory
export async function POST(_req: NextRequest, { params }: RouteParams) {
    const { name } = await params
    const decodedName = decodeURIComponent(name)

    try {
        // Send a chat request with keep_alive: 0 to unload from memory
        const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: decodedName,
                messages: [],
                keep_alive: 0,
            }),
        })

        if (!res.ok) {
            const text = await res.text().catch(() => 'Unknown error')
            return NextResponse.json(
                { success: false, error: `Failed to stop model: ${text}` },
                { status: res.status },
            )
        }

        return NextResponse.json({
            success: true,
            data: { message: `Model "${decodedName}" stopped` },
        })
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to stop model' },
            { status: 500 },
        )
    }
}
