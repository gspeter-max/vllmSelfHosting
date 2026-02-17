'use client'

import {
    Monitor,
    Cpu,
    MemoryStick,
    HardDrive,
    Server,
    Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { SystemInfo, HealthStatus } from '@/lib/types'

interface SystemOverviewProps {
    systemInfo: SystemInfo | null
    healthStatus: HealthStatus | null
    isLoading: boolean
}

export function SystemOverview({
    systemInfo,
    healthStatus,
    isLoading,
}: SystemOverviewProps) {
    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-6 w-32 mb-2" />
                            <Skeleton className="h-4 w-48" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (!systemInfo) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                        Unable to load system information.
                    </p>
                </CardContent>
            </Card>
        )
    }

    const infoCards = [
        {
            title: 'Operating System',
            icon: Monitor,
            value: systemInfo.os,
            detail: `Architecture: ${systemInfo.arch}`,
        },
        {
            title: 'CPU',
            icon: Cpu,
            value: systemInfo.cpu,
            detail: `${systemInfo.cpuCores} cores · Load: ${systemInfo.cpuLoad ?? 0}%`,
        },
        {
            title: 'Memory',
            icon: MemoryStick,
            value: systemInfo.ramTotal,
            detail: `Available: ${systemInfo.ramAvailable} · Used: ${systemInfo.ramUsed}`,
        },
        {
            title: 'GPU',
            icon: Zap,
            value: systemInfo.gpu ? systemInfo.gpu.name : 'No GPU Detected',
            detail: systemInfo.gpu
                ? `VRAM: ${(systemInfo.gpu.vramUsedMB / 1024).toFixed(1)}/${(systemInfo.gpu.vramTotalMB / 1024).toFixed(1)} GB · ${systemInfo.gpu.utilization}% util · ${systemInfo.gpu.temperature}°C`
                : 'nvidia-smi not available',
        },
        {
            title: 'Hostname',
            icon: Server,
            value: systemInfo.hostname ?? 'Unknown',
            detail: '',
        },
    ]

    return (
        <div className="space-y-6">
            {/* System info cards */}
            <div className="grid gap-4 md:grid-cols-2">
                {infoCards.map((card) => (
                    <Card key={card.title}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">
                                {card.title}
                            </CardTitle>
                            <card.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold">{card.value}</div>
                            {card.detail && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {card.detail}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Service health */}
            {healthStatus && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <HardDrive className="h-4 w-4" />
                            Service Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm">Ollama</span>
                                <Badge
                                    variant={
                                        healthStatus.ollama.status === 'healthy'
                                            ? 'default'
                                            : 'destructive'
                                    }
                                >
                                    {healthStatus.ollama.status}
                                </Badge>
                            </div>
                            {healthStatus.ollama.message && (
                                <p className="text-xs text-muted-foreground">
                                    {healthStatus.ollama.message}
                                </p>
                            )}
                            <div className="flex items-center justify-between">
                                <span className="text-sm">vLLM</span>
                                <Badge
                                    variant={
                                        healthStatus.vllm.status === 'healthy'
                                            ? 'default'
                                            : 'secondary'
                                    }
                                >
                                    {healthStatus.vllm.status}
                                </Badge>
                            </div>
                            {healthStatus.vllm.message && (
                                <p className="text-xs text-muted-foreground">
                                    {healthStatus.vllm.message}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
