'use client'

import { useState } from 'react'
import { useModels } from '@/hooks/use-models'
import { deleteModel, startModel, stopModel } from '@/lib/api'
import { addActivityEvent } from '@/components/dashboard/activity-log'
import { toast } from 'sonner'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    Copy,
    Play,
    Square,
    Trash2,
    ExternalLink,
} from 'lucide-react'
import type { Model } from '@/lib/types'

export default function ModelsPage() {
    const { models, isLoading, refetch } = useModels(5000) // Poll every 5s on this page
    const [deleteTarget, setDeleteTarget] = useState<Model | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const handleStart = async (model: Model) => {
        setActionLoading(model.name)
        try {
            await startModel(model.name)
            addActivityEvent({ type: 'start', model: model.name, message: `Started model "${model.name}"` })
            toast.success(`Model "${model.name}" started`)
            await refetch()
        } catch {
            toast.error(`Failed to start "${model.name}"`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleStop = async (model: Model) => {
        setActionLoading(model.name)
        try {
            await stopModel(model.name)
            addActivityEvent({ type: 'stop', model: model.name, message: `Stopped model "${model.name}"` })
            toast.success(`Model "${model.name}" stopped`)
            await refetch()
        } catch {
            toast.error(`Failed to stop "${model.name}"`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setActionLoading(deleteTarget.name)
        try {
            await deleteModel(deleteTarget.name)
            addActivityEvent({ type: 'remove', model: deleteTarget.name, message: `Removed model "${deleteTarget.name}"` })
            toast.success(`Model "${deleteTarget.name}" removed`)
            setDeleteTarget(null)
            await refetch()
        } catch {
            toast.error(`Failed to remove "${deleteTarget.name}"`)
        } finally {
            setActionLoading(null)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard')
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Model Management</h2>
                <p className="text-muted-foreground">
                    View, control, and manage your deployed models
                </p>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Model</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Quantization</TableHead>
                            <TableHead>API Endpoint</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 7 }).map((_, j) => (
                                        <TableCell key={j}>
                                            <Skeleton className="h-4 w-20" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : models.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No models deployed. Go to the Deploy page to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            models.map((model) => (
                                <TableRow key={model.name}>
                                    <TableCell className="font-medium">
                                        {model.displayName || model.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={model.type === 'cpu' ? 'secondary' : 'default'}>
                                            {model.type.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`h-2 w-2 rounded-full ${model.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                                                    }`}
                                            />
                                            <span className="capitalize">{model.status}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{model.size || '—'}</TableCell>
                                    <TableCell>{model.quantization || '—'}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[200px] truncate">
                                                {model.apiUrlOpenAI || model.apiUrl}
                                            </code>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => copyToClipboard(model.apiUrlOpenAI || model.apiUrl)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Copy endpoint URL</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {model.status === 'running' ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleStop(model)}
                                                            disabled={actionLoading === model.name}
                                                        >
                                                            <Square className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Stop model</TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleStart(model)}
                                                            disabled={actionLoading === model.name}
                                                        >
                                                            <Play className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Start model</TooltipContent>
                                                </Tooltip>
                                            )}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => setDeleteTarget(model)}
                                                        disabled={actionLoading === model.name}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Remove model</TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Delete confirmation dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Model</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove &quot;{deleteTarget?.name}&quot;? This
                            will delete the model files and cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={actionLoading === deleteTarget?.name}
                        >
                            {actionLoading === deleteTarget?.name ? 'Removing...' : 'Remove'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
