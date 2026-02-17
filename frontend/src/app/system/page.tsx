'use client'

import { useState, useEffect } from 'react'
import { SystemOverview } from '@/components/system/system-overview'
import { ResourceChart } from '@/components/system/resource-chart'
import { useSystemInfo } from '@/hooks/use-system-info'
import type { HealthStatus } from '@/lib/types'
import { getHealthStatus } from '@/lib/api'

export default function SystemPage() {
    const { data: systemInfo, isLoading: systemLoading } = useSystemInfo()
    const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
    const [healthLoading, setHealthLoading] = useState(true)

    useEffect(() => {
        async function fetchHealth() {
            try {
                const health = await getHealthStatus()
                setHealthStatus(health)
            } catch {
                // Health check failed — services probably not running
            } finally {
                setHealthLoading(false)
            }
        }
        fetchHealth()
        const interval = setInterval(fetchHealth, 15000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    System Information
                </h2>
                <p className="text-muted-foreground">
                    Hardware details and service health
                </p>
            </div>

            <SystemOverview
                systemInfo={systemInfo}
                healthStatus={healthStatus}
                isLoading={systemLoading || healthLoading}
            />

            <ResourceChart systemInfo={systemInfo} isLoading={systemLoading} />
        </div>
    )
}
