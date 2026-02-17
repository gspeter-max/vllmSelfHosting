import { NextRequest, NextResponse } from 'next/server'
import { deployments } from '../route'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { deployId, input } = body as { deployId?: string; input?: string }

        if (!deployId || typeof input !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Missing deployId or input' },
                { status: 400 },
            )
        }

        const deployment = deployments.get(deployId)
        if (!deployment) {
            return NextResponse.json(
                { success: false, error: 'Deployment not found' },
                { status: 404 },
            )
        }

        if (deployment.status !== 'running') {
            return NextResponse.json(
                { success: false, error: 'Deployment is not running' },
                { status: 400 },
            )
        }

        const { process: child } = deployment
        if (!child.stdin || child.stdin.destroyed) {
            return NextResponse.json(
                { success: false, error: 'Process stdin is not available' },
                { status: 500 },
            )
        }

        child.stdin.write(input + '\n')

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send input',
            },
            { status: 500 },
        )
    }
}
