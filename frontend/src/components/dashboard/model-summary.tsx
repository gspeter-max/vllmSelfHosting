'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { Model } from '@/lib/types'

interface ModelSummaryProps {
    models: Model[]
    isLoading: boolean
}

export function ModelSummary({ models, isLoading }: ModelSummaryProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-5 w-16" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Deployed Models</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/models">View all</Link>
                </Button>
            </CardHeader>
            <CardContent>
                {models.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No models deployed yet.{' '}
                        <Link href="/deploy" className="text-primary underline">
                            Deploy one now
                        </Link>
                    </p>
                ) : (
                    <div className="space-y-3">
                        {models.slice(0, 5).map((model) => (
                            <div
                                key={model.name}
                                className="flex items-center justify-between text-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`h-2 w-2 rounded-full ${model.status === 'running'
                                                ? 'bg-green-500'
                                                : 'bg-red-500'
                                            }`}
                                    />
                                    <span className="font-medium truncate max-w-[180px]">
                                        {model.displayName || model.name}
                                    </span>
                                </div>
                                <Badge variant={model.type === 'cpu' ? 'secondary' : 'default'}>
                                    {model.type.toUpperCase()}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
