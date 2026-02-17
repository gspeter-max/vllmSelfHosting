'use client'

import {
    Bar,
    BarChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SystemInfo } from '@/lib/types'

interface ResourceChartProps {
    systemInfo: SystemInfo | null
    isLoading: boolean
}

export function ResourceChart({ systemInfo, isLoading }: ResourceChartProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[200px] w-full" />
                </CardContent>
            </Card>
        )
    }

    if (!systemInfo) return null

    const totalGB = systemInfo.ramTotalBytes / (1024 * 1024 * 1024)
    const usedGB = systemInfo.ramUsedBytes / (1024 * 1024 * 1024)
    const availableGB = systemInfo.ramAvailableBytes / (1024 * 1024 * 1024)

    const data = [
        {
            name: 'RAM',
            used: Number(usedGB.toFixed(1)),
            available: Number(availableGB.toFixed(1)),
            total: Number(totalGB.toFixed(1)),
        },
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Memory Usage
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical">
                            <XAxis
                                type="number"
                                domain={[0, Math.ceil(totalGB)]}
                                unit=" GB"
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                width={40}
                            />
                            <Tooltip
                                formatter={(value: number) => `${value} GB`}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: 'var(--radius)',
                                }}
                            />
                            <Bar
                                dataKey="used"
                                stackId="ram"
                                fill="hsl(var(--chart-1))"
                                name="Used"
                                radius={[4, 0, 0, 4]}
                            />
                            <Bar
                                dataKey="available"
                                stackId="ram"
                                fill="hsl(var(--chart-2))"
                                name="Available"
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
                        <span className="text-muted-foreground">
                            Used ({usedGB.toFixed(1)} GB)
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                        <span className="text-muted-foreground">
                            Available ({availableGB.toFixed(1)} GB)
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
