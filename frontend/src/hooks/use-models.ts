'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Model } from '@/lib/types'
import { getModels } from '@/lib/api'
import { POLL_INTERVAL } from '@/lib/constants'

export function useModels(pollInterval: number = POLL_INTERVAL.models) {
    const [models, setModels] = useState<Model[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchModels = useCallback(async () => {
        try {
            const data = await getModels()
            setModels(data)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch models')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchModels()
        const interval = setInterval(fetchModels, pollInterval)
        return () => clearInterval(interval)
    }, [fetchModels, pollInterval])

    return { models, isLoading, error, refetch: fetchModels }
}
