import { NextRequest, NextResponse } from 'next/server'
import { OLLAMA_API } from '@/lib/constants'

interface RouteParams {
    params: Promise<{ name: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
    const { name } = await params
    const decodedName = decodeURIComponent(name)

    try {
        // Get model details from Ollama
        const res = await fetch(OLLAMA_API.show, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: decodedName }),
        })

        if (!res.ok) {
            return NextResponse.json(
                { success: false, error: `Model "${decodedName}" not found` },
                { status: 404 },
            )
        }

        const data = await res.json()

        return NextResponse.json({
            success: true,
            data: {
                name: decodedName,
                type: 'cpu',
                status: 'stopped', // Details endpoint doesn't tell running status
                port: 11434,
                apiUrl: `http://localhost:11434/api/chat`,
                apiUrlOpenAI: `http://localhost:11434/v1/chat/completions`,
                family: data.details?.family,
                parameterSize: data.details?.parameter_size,
                quantization: data.details?.quantization_level,
            },
        })
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to get model details' },
            { status: 500 },
        )
    }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    const { name } = await params
    const decodedName = decodeURIComponent(name)

    try {
        const res = await fetch(OLLAMA_API.delete, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: decodedName }),
        })

        if (!res.ok) {
            const text = await res.text().catch(() => 'Unknown error')
            return NextResponse.json(
                { success: false, error: `Failed to delete model: ${text}` },
                { status: res.status },
            )
        }

        return NextResponse.json({ success: true, data: null })
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to delete model' },
            { status: 500 },
        )
    }
}
