'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Heart, Box, Cpu, FileText, Scale } from 'lucide-react'
import type { HFModelInfo } from '@/lib/types'

interface ModelInfoCardProps {
    model: HFModelInfo | null
    isLoading: boolean
    error: string | null
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return String(n)
}

export function ModelInfoCard({ model, isLoading, error }: ModelInfoCardProps) {
    if (!isLoading && !model && !error) return null

    if (isLoading) {
        return (
            <Card className="border-dashed">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-5 w-16" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-4">
                    <p className="text-sm text-destructive">{error}</p>
                </CardContent>
            </Card>
        )
    }

    if (!model) return null

    const infoItems = [
        model.architecture && { icon: Cpu, label: model.architecture },
        model.parametersFormatted && { icon: Box, label: `${model.parametersFormatted} params` },
        model.contextLength && { icon: FileText, label: `${model.contextLength.toLocaleString()} ctx` },
        model.license && { icon: Scale, label: model.license },
    ].filter(Boolean) as { icon: typeof Cpu; label: string }[]

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    {/* Left: Model info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm truncate">{model.id}</h4>
                            {model.hasGguf && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                    GGUF
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                            by {model.author} · {model.pipeline}
                        </p>

                        {/* Info chips */}
                        <div className="flex flex-wrap gap-2">
                            {infoItems.map((item) => (
                                <span
                                    key={item.label}
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md"
                                >
                                    <item.icon className="h-3 w-3" />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Right: Stats */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            {formatNumber(model.downloads)}
                        </span>
                        <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {formatNumber(model.likes)}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
