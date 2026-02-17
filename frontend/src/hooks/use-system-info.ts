'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SystemInfo } from '@/lib/types'
import { getSystemInfo } from '@/lib/api'
import { POLL_INTERVAL } from '@/lib/constants'

const MAX_HISTORY = 60 // 2 minutes at 2s intervals

export interface SystemSnapshot {
    timestamp: number
    ramUsedGB: number
    ramTotalGB: number
    cpuLoad: number
    vramUsedMB: number | null
    vramTotalMB: number | null
    gpuUtil: number | null
}

export function useSystemInfo(pollInterval = POLL_INTERVAL.system) {
    const [data, setData] = useState<SystemInfo | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<SystemSnapshot[]>([])
    const historyRef = useRef<SystemSnapshot[]>([])

    const fetchData = useCallback(async () => {
        try {
            const info = await getSystemInfo()
            setData(info)
            setError(null)

            // Append to history ring buffer
            const snapshot: SystemSnapshot = {
                timestamp: Date.now(),
                ramUsedGB: info.ramUsedBytes / (1024 * 1024 * 1024),
                ramTotalGB: info.ramTotalBytes / (1024 * 1024 * 1024),
                cpuLoad: info.cpuLoad ?? 0,
                vramUsedMB: info.gpu?.vramUsedMB ?? null,
                vramTotalMB: info.gpu?.vramTotalMB ?? null,
                gpuUtil: info.gpu?.utilization ?? null,
            }

            const next = [...historyRef.current, snapshot].slice(-MAX_HISTORY)
            historyRef.current = next
            setHistory(next)
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

    return { data, isLoading, error, history, refetch: fetchData }
}
