'use client'

import { Box, Activity, MemoryStick, Cpu } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Model, SystemInfo, HealthStatus } from '@/lib/types'

interface StatsCardsProps {
    models: Model[]
    systemInfo: SystemInfo | null
    healthStatus: HealthStatus | null
    isLoading: boolean
}

export function StatsCards({
    models,
    systemInfo,
    healthStatus,
    isLoading,
}: StatsCardsProps) {
    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-7 w-16" />
                            <Skeleton className="h-3 w-32 mt-1" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    const totalModels = models.length
    const runningModels = models.filter((m) => m.status === 'running').length
    const ramUsed = systemInfo?.ramUsed ?? '—'
    const mode =
        healthStatus?.ollama.status === 'healthy'
            ? 'CPU (Ollama)'
            : healthStatus?.vllm.status === 'healthy'
                ? 'GPU (vLLM)'
                : 'Offline'

    const cards = [
        {
            title: 'Models Deployed',
            value: totalModels.toString(),
            description: `${runningModels} currently running`,
            icon: Box,
        },
        {
            title: 'Models Running',
            value: runningModels.toString(),
            description: totalModels > 0 ? `of ${totalModels} total` : 'No models deployed',
            icon: Activity,
        },
        {
            title: 'RAM Usage',
            value: ramUsed,
            description: systemInfo
                ? `${systemInfo.ramAvailable} available of ${systemInfo.ramTotal}`
                : 'Loading...',
            icon: MemoryStick,
        },
        {
            title: 'Mode',
            value: mode,
            description:
                healthStatus?.ollama.status === 'healthy'
                    ? 'Ollama API active'
                    : healthStatus?.vllm.status === 'healthy'
                        ? 'vLLM API active'
                        : 'No services running',
            icon: Cpu,
        },
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        <card.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                        <p className="text-xs text-muted-foreground">{card.description}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
