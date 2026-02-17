'use client'

import {
    Area,
    AreaChart,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SystemInfo } from '@/lib/types'
import type { SystemSnapshot } from '@/hooks/use-system-info'

interface ResourceChartProps {
    systemInfo: SystemInfo | null
    isLoading: boolean
    history: SystemSnapshot[]
}

function formatTime(ts: number): string {
    const d = new Date(ts)
    return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

// Explicit vibrant colors that work well in both light and dark themes
const COLORS = {
    ram: '#3b82f6',       // Blue-500 — vivid blue
    cpu: '#10b981',       // Emerald-500 — vivid green
    gpu: '#a855f7',       // Purple-500 — vivid purple
    kvCache: '#f97316',   // Orange-500 — vivid orange
    available: '#64748b', // Slate-500 — neutral complement
    grid: '#334155',      // Slate-700 — subtle grid (dark), overridden per-mode via opacity
    axis: '#94a3b8',      // Slate-400 — readable in both modes
}

export function ResourceChart({ systemInfo, isLoading, history }: ResourceChartProps) {
    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!systemInfo) return null

    const totalGB = systemInfo.ramTotalBytes / (1024 * 1024 * 1024)
    const hasGpu = systemInfo.gpu !== null

    // Chart data from history
    const ramData = history.map((s) => ({
        time: formatTime(s.timestamp),
        used: Number(s.ramUsedGB.toFixed(2)),
        available: Number((s.ramTotalGB - s.ramUsedGB).toFixed(2)),
    }))

    const cpuData = history.map((s) => ({
        time: formatTime(s.timestamp),
        load: s.cpuLoad,
    }))

    const gpuData = hasGpu
        ? history
            .filter((s) => s.vramUsedMB !== null)
            .map((s) => ({
                time: formatTime(s.timestamp),
                used: Number(((s.vramUsedMB ?? 0) / 1024).toFixed(2)),
                free: Number(((s.vramTotalMB ?? 0) / 1024 - (s.vramUsedMB ?? 0) / 1024).toFixed(2)),
            }))
        : []

    const tooltipStyle: React.CSSProperties = {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#f1f5f9',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* RAM Chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.ram }} />
                            RAM Usage
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                            {(totalGB).toFixed(1)} GB total
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px]">
                        {ramData.length < 2 ? (
                            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                Collecting data...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={ramData}>
                                    <defs>
                                        <linearGradient id="ramUsedGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.ram} stopOpacity={0.35} />
                                            <stop offset="95%" stopColor={COLORS.ram} stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.15} />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fontSize: 10, fill: COLORS.axis }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        domain={[0, Math.ceil(totalGB)]}
                                        tick={{ fontSize: 10, fill: COLORS.axis }}
                                        tickLine={false}
                                        axisLine={false}
                                        unit=" GB"
                                        width={55}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [`${value} GB`, 'Used']}
                                        contentStyle={tooltipStyle}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="used"
                                        stroke={COLORS.ram}
                                        fill="url(#ramUsedGrad)"
                                        strokeWidth={2.5}
                                        name="Used"
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    {ramData.length > 0 && (
                        <div className="mt-2 flex items-center justify-center gap-6 text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.ram }} />
                                <span className="text-muted-foreground">
                                    Used ({ramData[ramData.length - 1]?.used} GB)
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.available }} />
                                <span className="text-muted-foreground">
                                    Available ({ramData[ramData.length - 1]?.available} GB)
                                </span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* CPU Load Chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.cpu }} />
                            CPU Load
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                            {systemInfo.cpuCores} cores
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px]">
                        {cpuData.length < 2 ? (
                            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                Collecting data...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={cpuData}>
                                    <defs>
                                        <linearGradient id="cpuLoadGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.cpu} stopOpacity={0.35} />
                                            <stop offset="95%" stopColor={COLORS.cpu} stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.15} />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fontSize: 10, fill: COLORS.axis }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        tick={{ fontSize: 10, fill: COLORS.axis }}
                                        tickLine={false}
                                        axisLine={false}
                                        unit="%"
                                        width={45}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [`${value}%`, 'CPU Load']}
                                        contentStyle={tooltipStyle}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="load"
                                        stroke={COLORS.cpu}
                                        fill="url(#cpuLoadGrad)"
                                        strokeWidth={2.5}
                                        name="CPU Load"
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    {cpuData.length > 0 && (
                        <div className="mt-2 flex items-center justify-center text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.cpu }} />
                                <span className="text-muted-foreground">
                                    Current: {cpuData[cpuData.length - 1]?.load}%
                                </span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* GPU VRAM Chart — only if GPU detected */}
            {hasGpu && systemInfo.gpu && (
                <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.gpu }} />
                                GPU VRAM — {systemInfo.gpu.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-normal">
                                {(systemInfo.gpu.vramTotalMB / 1024).toFixed(1)} GB total · {systemInfo.gpu.temperature}°C · {systemInfo.gpu.utilization}% util
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px]">
                            {gpuData.length < 2 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                    Collecting data...
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={gpuData}>
                                        <defs>
                                            <linearGradient id="gpuUsedGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS.gpu} stopOpacity={0.35} />
                                                <stop offset="95%" stopColor={COLORS.gpu} stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.15} />
                                        <XAxis
                                            dataKey="time"
                                            tick={{ fontSize: 10, fill: COLORS.axis }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            domain={[0, Math.ceil(systemInfo.gpu.vramTotalMB / 1024)]}
                                            tick={{ fontSize: 10, fill: COLORS.axis }}
                                            tickLine={false}
                                            axisLine={false}
                                            unit=" GB"
                                            width={55}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => [`${value} GB`, 'VRAM Used']}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: '#94a3b8' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="used"
                                            stroke={COLORS.gpu}
                                            fill="url(#gpuUsedGrad)"
                                            strokeWidth={2.5}
                                            name="VRAM Used"
                                            dot={false}
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        {systemInfo.vllmKvCachePercent !== null && (
                            <div className="mt-2 flex items-center justify-center text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.kvCache }} />
                                    <span className="text-muted-foreground">
                                        vLLM KV Cache: {(systemInfo.vllmKvCachePercent * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
