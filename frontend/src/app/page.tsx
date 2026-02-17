'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Rocket, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { ModelSummary } from '@/components/dashboard/model-summary'
import { ActivityLog } from '@/components/dashboard/activity-log'
import { useModels } from '@/hooks/use-models'
import { useSystemInfo } from '@/hooks/use-system-info'
import type { HealthStatus } from '@/lib/types'
import { getHealthStatus } from '@/lib/api'

export default function DashboardPage() {
  const { models, isLoading: modelsLoading } = useModels()
  const { data: systemInfo, isLoading: systemLoading } = useSystemInfo()
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  useEffect(() => {
    async function fetchHealth() {
      try {
        const health = await getHealthStatus()
        setHealthStatus(health)
      } catch {
        // Services not running
      } finally {
        setHealthLoading(false)
      }
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  const isLoading = modelsLoading || systemLoading || healthLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your LLM deployments
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/deploy">
              <Rocket className="mr-2 h-4 w-4" />
              Deploy Model
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Open Chat
            </Link>
          </Button>
        </div>
      </div>

      <StatsCards
        models={models}
        systemInfo={systemInfo}
        healthStatus={healthStatus}
        isLoading={isLoading}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ModelSummary models={models} isLoading={modelsLoading} />
        <ActivityLog isLoading={modelsLoading} />
      </div>
    </div>
  )
}
