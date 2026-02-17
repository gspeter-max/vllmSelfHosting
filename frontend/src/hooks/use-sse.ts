'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSSEOptions {
    url: string
    enabled?: boolean
    onMessage?: (event: MessageEvent) => void
    onError?: (error: Event) => void
}

export function useSSE({ url, enabled = true, onMessage, onError }: UseSSEOptions) {
    const [isConnected, setIsConnected] = useState(false)
    const [lastEvent, setLastEvent] = useState<string | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)

    const connect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
        }

        const es = new EventSource(url)
        eventSourceRef.current = es

        es.onopen = () => setIsConnected(true)

        es.onmessage = (event) => {
            setLastEvent(event.data)
            onMessage?.(event)
        }

        es.onerror = (event) => {
            setIsConnected(false)
            onError?.(event)
        }

        return es
    }, [url, onMessage, onError])

    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
            setIsConnected(false)
        }
    }, [])

    useEffect(() => {
        if (enabled) {
            connect()
        }
        return () => disconnect()
    }, [enabled, connect, disconnect])

    return { isConnected, lastEvent, connect, disconnect }
}
