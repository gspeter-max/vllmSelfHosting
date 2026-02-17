'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SystemInfo } from '@/lib/types'
import { getSystemInfo } from '@/lib/api'
import { POLL_INTERVAL } from '@/lib/constants'

export function useSystemInfo(pollInterval = POLL_INTERVAL.system) {
    const [data, setData] = useState<SystemInfo | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const info = await getSystemInfo()
            setData(info)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch system info')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, pollInterval)
        return () => clearInterval(interval)
    }, [fetchData, pollInterval])

    return { data, isLoading, error, refetch: fetchData }
}
