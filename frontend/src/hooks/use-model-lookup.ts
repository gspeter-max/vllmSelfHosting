'use client'

import { useEffect, useRef, useState } from 'react'
import type { HFModelInfo } from '@/lib/types'

interface UseModelLookupResult {
    data: HFModelInfo | null
    isLoading: boolean
    error: string | null
}

/**
 * Debounced HuggingFace model lookup hook.
 * Fetches model info from /api/models/lookup when the repo
 * matches `org/name` format, with 500ms debounce.
 */
export function useModelLookup(repo: string): UseModelLookupResult {
    const [data, setData] = useState<HFModelInfo | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        // Clear any pending debounce
        if (timerRef.current) clearTimeout(timerRef.current)

        const trimmed = repo.trim()

        // Must match org/name format
        if (!trimmed || !trimmed.includes('/') || trimmed.split('/').length !== 2) {
            setData(null)
            setError(null)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        // Debounce 500ms
        timerRef.current = setTimeout(async () => {
            // Abort any in-flight request
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            try {
                const res = await fetch(
                    `/api/models/lookup?repo=${encodeURIComponent(trimmed)}`,
                    { signal: controller.signal },
                )
                const json = await res.json()

                if (!controller.signal.aborted) {
                    if (json.success && json.data) {
                        setData(json.data)
                        setError(null)
                    } else {
                        setData(null)
                        setError(json.error ?? 'Failed to fetch model info')
                    }
                    setIsLoading(false)
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    if (err instanceof Error && err.name !== 'AbortError') {
                        setError(err.message)
                    }
                    setData(null)
                    setIsLoading(false)
                }
            }
        }, 500)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            abortRef.current?.abort()
        }
    }, [repo])

    return { data, isLoading, error }
}
