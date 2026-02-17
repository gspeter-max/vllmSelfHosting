'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Rocket, Square, Trash2, AlertTriangle, Play } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { ACTIVITY_STORAGE_KEY, MAX_ACTIVITY_ENTRIES } from '@/lib/constants'
import type { ActivityEvent } from '@/lib/types'

interface ActivityLogProps {
    isLoading?: boolean
}

const iconMap = {
    deploy: Rocket,
    start: Play,
    stop: Square,
    remove: Trash2,
    error: AlertTriangle,
}

export function ActivityLog({ isLoading }: ActivityLogProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([])

    useEffect(() => {
        try {
            const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
            if (stored) {
                setEvents(JSON.parse(stored))
            }
        } catch {
            // localStorage not available or corrupted
        }
    }, [])

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
                {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent activity.</p>
                ) : (
                    <ScrollArea className="h-[240px]">
                        <div className="space-y-4">
                            {events.slice(0, MAX_ACTIVITY_ENTRIES).map((event) => {
                                const Icon = iconMap[event.type] || Rocket
                                return (
                                    <div key={event.id} className="flex items-start gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-sm leading-tight">{event.message}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatRelativeTime(event.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    )
}

/**
 * Helper to add an activity event to localStorage.
 * Can be called from any component.
 */
export function addActivityEvent(event: Omit<ActivityEvent, 'id' | 'timestamp'>) {
    try {
        const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
        const events: ActivityEvent[] = stored ? JSON.parse(stored) : []
        events.unshift({
            ...event,
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestamp: Date.now(),
        })
        // Keep only the most recent entries
        const trimmed = events.slice(0, MAX_ACTIVITY_ENTRIES)
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
        // localStorage not available
    }
}
