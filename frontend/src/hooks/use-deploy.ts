'use client'

import { useState, useCallback, useRef } from 'react'
import type { DeployRequest, DeployEvent } from '@/lib/types'
import { startDeploy } from '@/lib/api'
import { API_ROUTES } from '@/lib/constants'
import type { PendingPrompt, PromptType } from '@/components/deploy/prompt-dialog'

type DeployStatus = 'idle' | 'deploying' | 'completed' | 'failed'

// Pattern matchers for interactive prompts
const PROMPT_PATTERNS: { pattern: RegExp; type: PromptType; message: string }[] = [
    {
        pattern: /Continue anyway\?\s*\[y\/N\]/i,
        type: 'confirm-no',
        message: 'The model will use a significant amount of your RAM budget. Your system may become slow while the model is running.\n\nDo you want to continue anyway?',
    },
    {
        pattern: /Proceed\?\s*\[Y\/n\]/i,
        type: 'confirm-yes',
        message: 'The model fits within your RAM budget.\n\nDo you want to proceed?',
    },
    {
        pattern: /Type CONFIRM to proceed/i,
        type: 'danger-confirm',
        message: 'This model will use a very large amount of your RAM budget. This WILL cause severe system slowdown and other apps may crash.\n\nType CONFIRM to proceed.',
    },
    {
        pattern: /Enter the parameter count in billions/i,
        type: 'text-input',
        message: 'Could not detect parameter count from the model name.\n\nPlease enter the parameter count in billions (e.g., 7 for 7B, 1.1 for 1.1B):',
    },
]

function detectPrompt(line: string): PendingPrompt | null {
    // Strip ANSI escape codes for pattern matching
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '')
    for (const { pattern, type, message } of PROMPT_PATTERNS) {
        if (pattern.test(clean)) {
            return { type, message, rawLine: line }
        }
    }
    return null
}

export function useDeploy() {
    const [status, setStatus] = useState<DeployStatus>('idle')
    const [deployId, setDeployId] = useState<string | null>(null)
    const [logs, setLogs] = useState<DeployEvent[]>([])
    const [error, setError] = useState<string | null>(null)
    const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)
    const deployIdRef = useRef<string | null>(null)

    const deploy = useCallback(async (request: DeployRequest) => {
        setStatus('deploying')
        setLogs([])
        setError(null)
        setPendingPrompt(null)

        try {
            const result = await startDeploy(request)
            setDeployId(result.deployId)
            deployIdRef.current = result.deployId

            // Connect to SSE stream
            const es = new EventSource(
                `${API_ROUTES.deployStream}?deployId=${result.deployId}`,
            )
            eventSourceRef.current = es

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as DeployEvent
                    setLogs((prev) => [...prev, data])

                    // Check for interactive prompts
                    if (data.type === 'output' || data.type === 'error') {
                        const prompt = detectPrompt(data.data)
                        if (prompt) {
                            setPendingPrompt(prompt)
                        }
                    }

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

    const sendInput = useCallback(async (input: string) => {
        const id = deployIdRef.current
        if (!id) return

        setPendingPrompt(null)

        try {
            const res = await fetch(API_ROUTES.deployStdin, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deployId: id, input }),
            })
            if (!res.ok) {
                const data = await res.json()
                console.error('Failed to send stdin:', data.error)
            }
        } catch (err) {
            console.error('Failed to send stdin:', err)
        }
    }, [])

    const dismissPrompt = useCallback(() => {
        setPendingPrompt(null)
    }, [])

    const reset = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        setStatus('idle')
        setDeployId(null)
        deployIdRef.current = null
        setLogs([])
        setError(null)
        setPendingPrompt(null)
    }, [])

    return { status, deployId, logs, error, pendingPrompt, deploy, sendInput, dismissPrompt, reset }
}
