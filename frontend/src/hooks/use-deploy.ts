'use client'

import { useState, useCallback, useRef } from 'react'
import type { DeployRequest, DeployEvent } from '@/lib/types'
import { startDeploy } from '@/lib/api'
import { API_ROUTES } from '@/lib/constants'

type DeployStatus = 'idle' | 'deploying' | 'completed' | 'failed'

export function useDeploy() {
    const [status, setStatus] = useState<DeployStatus>('idle')
    const [deployId, setDeployId] = useState<string | null>(null)
    const [logs, setLogs] = useState<DeployEvent[]>([])
    const [error, setError] = useState<string | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)

    const deploy = useCallback(async (request: DeployRequest) => {
        setStatus('deploying')
        setLogs([])
        setError(null)

        try {
            const result = await startDeploy(request)
            setDeployId(result.deployId)

            // Connect to SSE stream
            const es = new EventSource(
                `${API_ROUTES.deployStream}?deployId=${result.deployId}`,
            )
            eventSourceRef.current = es

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as DeployEvent
                    setLogs((prev) => [...prev, data])

                    if (data.type === 'complete') {
                        setStatus(data.data === 'completed' ? 'completed' : 'failed')
                        es.close()
                    }
                } catch {
                    // Ignore parse errors
                }
            }

            es.onerror = () => {
                setStatus('failed')
                setError('Connection to deployment stream lost')
                es.close()
            }
        } catch (err) {
            setStatus('failed')
            setError(err instanceof Error ? err.message : 'Failed to start deployment')
        }
    }, [])

    const reset = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        setStatus('idle')
        setDeployId(null)
        setLogs([])
        setError(null)
    }, [])

    return { status, deployId, logs, error, deploy, reset }
}
