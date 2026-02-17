import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { deployRequestSchema } from '@/lib/validators'
import { generateId } from '@/lib/utils'

// In-memory store for active deployments
const deployments = new Map<
    string,
    {
        process: ReturnType<typeof spawn>
        logs: string[]
        status: 'running' | 'completed' | 'failed'
    }
>()

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const parsed = deployRequestSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid deploy request',
                    details: parsed.error.issues.map((i) => i.message),
                },
                { status: 400 },
            )
        }

        const { mode, model, runMode, gpuSlot, quantization } = parsed.data

        // Check for concurrent deployments
        const activeDeployment = Array.from(deployments.values()).find(
            (d) => d.status === 'running',
        )
        if (activeDeployment) {
            return NextResponse.json(
                { success: false, error: 'A deployment is already in progress' },
                { status: 409 },
            )
        }

        const deployId = generateId()
        const repoRoot = path.resolve(process.cwd(), '..')

        let command: string
        let args: string[]

        if (mode === 'cpu') {
            command = 'bash'
            args = [
                path.join(repoRoot, 'deploy_cpu.sh'),
                model,
                `--${runMode || 'background'}`,
            ]
            if (quantization) {
                args.push('--quant', quantization)
            }
        } else {
            command = 'bash'
            args = [
                path.join(repoRoot, 'deploy_model.sh'),
                model,
                String(gpuSlot ?? 0),
            ]
        }

        const child = spawn(command, args, {
            cwd: repoRoot,
            env: { ...process.env },
        })

        const deployment = {
            process: child,
            logs: [] as string[],
            status: 'running' as const,
        }

        deployments.set(deployId, deployment)

        child.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(Boolean)
            deployment.logs.push(...lines)
        })

        child.stderr.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(Boolean)
            deployment.logs.push(...lines.map((l) => `[stderr] ${l}`))
        })

        child.on('close', (code) => {
            const d = deployments.get(deployId)
            if (d) {
                d.status = code === 0 ? 'completed' : 'failed'
                d.logs.push(
                    code === 0
                        ? '✅ Deployment completed successfully!'
                        : `❌ Deployment failed with exit code ${code}`,
                )
            }
        })

        child.on('error', (err) => {
            const d = deployments.get(deployId)
            if (d) {
                d.status = 'failed'
                d.logs.push(`[error] ${err.message}`)
            }
        })

        return NextResponse.json({
            deployId,
            status: 'started',
            message: `Deploying ${model} in ${mode} mode`,
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to start deployment',
            },
            { status: 500 },
        )
    }
}

// Export deployments map for SSE stream route
export { deployments }
