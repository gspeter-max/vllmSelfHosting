import { NextRequest } from 'next/server'
import { deployments } from '../route'

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams
    const deployId = searchParams.get('deployId')

    if (!deployId) {
        return new Response('Missing deployId parameter', { status: 400 })
    }

    const deployment = deployments.get(deployId)
    if (!deployment) {
        return new Response('Deployment not found', { status: 404 })
    }

    const encoder = new TextEncoder()
    let lastIndex = 0
    let closed = false

    const stream = new ReadableStream({
        start(controller) {
            // Send initial event
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'status', data: 'connected' })}\n\n`),
            )

            const interval = setInterval(() => {
                if (closed) {
                    clearInterval(interval)
                    return
                }

                const dep = deployments.get(deployId)
                if (!dep) {
                    clearInterval(interval)
                    controller.close()
                    return
                }

                // Send new log lines
                while (lastIndex < dep.logs.length) {
                    const line = dep.logs[lastIndex]
                    const eventType = line.startsWith('[stderr]') || line.startsWith('[error]') ? 'error' : 'output'
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({ type: eventType, data: line, timestamp: Date.now() })}\n\n`,
                        ),
                    )
                    lastIndex++
                }

                // Send completion event
                if (dep.status !== 'running') {
                    controller.enqueue(
                        encoder.encode(
                            `data: ${JSON.stringify({ type: 'complete', data: dep.status, timestamp: Date.now() })}\n\n`,
                        ),
                    )
                    clearInterval(interval)
                    // Clean up after 60s
                    setTimeout(() => deployments.delete(deployId), 60000)
                    controller.close()
                }
            }, 500)
        },
        cancel() {
            closed = true
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    })
}
