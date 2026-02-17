'use client'

import { useState } from 'react'
import { useDeploy } from '@/hooks/use-deploy'
import { addActivityEvent } from '@/components/dashboard/activity-log'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Cpu, Zap, Rocket, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { QUANTIZATION_OPTIONS } from '@/lib/constants'
import type { DeployMode } from '@/lib/types'

export default function DeployPage() {
    const [mode, setMode] = useState<DeployMode>('cpu')
    const [model, setModel] = useState('')
    const [gpuSlot, setGpuSlot] = useState<string>('0')
    const { status, logs, error, deploy, reset } = useDeploy()

    const handleDeploy = async () => {
        if (!model.trim()) return

        await deploy({
            mode,
            model: model.trim(),
            gpuSlot: mode === 'gpu' ? (parseInt(gpuSlot) as 0 | 1) : undefined,
        })

        addActivityEvent({
            type: 'deploy',
            model: model.trim(),
            message: `Started deploying "${model.trim()}" in ${mode.toUpperCase()} mode`,
        })
    }

    const isDeploying = status === 'deploying'
    const isComplete = status === 'completed'
    const isFailed = status === 'failed'

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Deploy Model</h2>
                <p className="text-muted-foreground">
                    Deploy a new LLM model on CPU (Ollama) or GPU (vLLM)
                </p>
            </div>

            {/* Mode Selector */}
            <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as DeployMode)}
                className="w-full"
            >
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="cpu" className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        CPU (Ollama)
                    </TabsTrigger>
                    <TabsTrigger value="gpu" className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        GPU (vLLM)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="cpu" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">
                                CPU Deployment via Ollama
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">
                                    HuggingFace Model
                                </label>
                                <Input
                                    placeholder="e.g. TinyLlama/TinyLlama-1.1B-Chat-v1.0"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    disabled={isDeploying}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Enter the HuggingFace repository name. The script will auto-select the best quantization.
                                </p>
                            </div>

                            {/* Quantization reference table */}
                            <div>
                                <h4 className="text-sm font-medium mb-2">
                                    Quantization Reference
                                </h4>
                                <div className="rounded-lg border">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="p-2 text-left font-medium">Quant</th>
                                                <th className="p-2 text-left font-medium">Bits</th>
                                                <th className="p-2 text-left font-medium">Size</th>
                                                <th className="p-2 text-left font-medium">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {QUANTIZATION_OPTIONS.map((q) => (
                                                <tr
                                                    key={q.name}
                                                    className={`border-b last:border-0 ${q.recommended ? 'bg-primary/5' : ''
                                                        }`}
                                                >
                                                    <td className="p-2 font-mono text-xs">
                                                        {q.name}
                                                        {q.recommended && (
                                                            <Badge variant="default" className="ml-2 text-[10px]">
                                                                Recommended
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-2">{q.bits}</td>
                                                    <td className="p-2">{q.size}</td>
                                                    <td className="p-2 text-muted-foreground">
                                                        {q.description}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="gpu" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">
                                GPU Deployment via vLLM
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">
                                    HuggingFace Model
                                </label>
                                <Input
                                    placeholder="e.g. meta-llama/Llama-2-7b-chat-hf"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    disabled={isDeploying}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">
                                    GPU Slot
                                </label>
                                <Select value={gpuSlot} onValueChange={setGpuSlot}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">GPU 0 (Port 8104)</SelectItem>
                                        <SelectItem value="1">GPU 1 (Port 8105)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Alert>
                                <AlertDescription>
                                    GPU deployment requires a Linux server with NVIDIA GPUs and vLLM installed.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Deploy Button */}
            <div className="flex gap-2">
                <Button
                    onClick={handleDeploy}
                    disabled={!model.trim() || isDeploying}
                    className="min-w-[140px]"
                >
                    {isDeploying ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deploying...
                        </>
                    ) : (
                        <>
                            <Rocket className="mr-2 h-4 w-4" />
                            Deploy
                        </>
                    )}
                </Button>
                {(isComplete || isFailed) && (
                    <Button variant="outline" onClick={reset}>
                        Deploy Another
                    </Button>
                )}
            </div>

            {/* Error */}
            {error && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Deploy Progress */}
            {logs.length > 0 && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                            Deployment Progress
                        </CardTitle>
                        <Badge
                            variant={
                                isComplete ? 'default' : isFailed ? 'destructive' : 'secondary'
                            }
                        >
                            {isComplete ? (
                                <span className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> Complete
                                </span>
                            ) : isFailed ? (
                                <span className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> Failed
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Running
                                </span>
                            )}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <div className="font-mono text-xs space-y-0.5 p-3 bg-muted/50 rounded-lg">
                                {logs.map((log, i) => (
                                    <div
                                        key={i}
                                        className={`${log.type === 'error'
                                            ? 'text-destructive'
                                            : log.type === 'complete'
                                                ? 'text-green-500 font-bold'
                                                : 'text-foreground'
                                            }`}
                                    >
                                        {log.data}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
