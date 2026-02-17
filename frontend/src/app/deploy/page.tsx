'use client'

import { useState } from 'react'
import { useDeploy } from '@/hooks/use-deploy'
import { useModelLookup } from '@/hooks/use-model-lookup'
import { addActivityEvent } from '@/components/dashboard/activity-log'
import { DeployTerminal } from '@/components/deploy/deploy-terminal'
import { PromptDialog } from '@/components/deploy/prompt-dialog'
import { ModelInfoCard } from '@/components/deploy/model-info-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Cpu, Zap, Rocket, XCircle, Loader2 } from 'lucide-react'
import { QUANTIZATION_OPTIONS } from '@/lib/constants'
import type { DeployMode } from '@/lib/types'

function formatFileSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(0)} MB`
}

export default function DeployPage() {
    const [mode, setMode] = useState<DeployMode>('cpu')
    const [model, setModel] = useState('')
    const [gpuSlot, setGpuSlot] = useState<string>('0')
    const [selectedQuant, setSelectedQuant] = useState('Q4_K_M')
    const [autoSelect, setAutoSelect] = useState(false)
    const { status, logs, error, pendingPrompt, deploy, sendInput, dismissPrompt, reset } = useDeploy()
    const { data: modelInfo, isLoading: modelInfoLoading, error: modelInfoError } = useModelLookup(model)

    const handleDeploy = async () => {
        if (!model.trim()) return

        // If GGUF files are available, use the selected GGUF filename
        let quantization = mode === 'cpu' && !autoSelect ? selectedQuant : undefined
        if (mode === 'cpu' && !autoSelect && modelInfo?.hasGguf) {
            const ggufFile = modelInfo.ggufFiles.find((f) => f.quantization === selectedQuant)
            if (ggufFile) {
                quantization = ggufFile.quantization
            }
        }

        await deploy({
            mode,
            model: model.trim(),
            quantization,
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

    // Use dynamic GGUF files when available, fallback to static options
    const useDynamicQuant = modelInfo?.hasGguf && modelInfo.ggufFiles.length > 0

    // Auto-select Q4_K_M in GGUF files if available
    const hasSelectedInGguf = useDynamicQuant && modelInfo.ggufFiles.some((f) => f.quantization === selectedQuant)
    if (useDynamicQuant && !hasSelectedInGguf && modelInfo.ggufFiles.length > 0) {
        const q4km = modelInfo.ggufFiles.find((f) => f.quantization === 'Q4_K_M')
        if (q4km) {
            setSelectedQuant('Q4_K_M')
        } else {
            // Pick the middle file as default
            const mid = Math.floor(modelInfo.ggufFiles.length / 2)
            setSelectedQuant(modelInfo.ggufFiles[mid].quantization)
        }
    }

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
                                    placeholder="e.g. TheBloke/Llama-2-7B-Chat-GGUF"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    disabled={isDeploying}
                                    data-testid="model-input"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Enter the HuggingFace repository name. Model info will load automatically.
                                </p>
                            </div>

                            {/* Model Info Card (dynamic) */}
                            <ModelInfoCard
                                model={modelInfo}
                                isLoading={modelInfoLoading}
                                error={modelInfoError}
                            />

                            {/* Quantization selector */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium">
                                        Quantization
                                        {useDynamicQuant && (
                                            <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                                                {modelInfo.ggufFiles.length} files from repo
                                            </Badge>
                                        )}
                                    </h4>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-xs text-muted-foreground">
                                            Auto-select
                                        </span>
                                        <Switch
                                            checked={autoSelect}
                                            onCheckedChange={setAutoSelect}
                                            data-testid="auto-select-toggle"
                                        />
                                    </label>
                                </div>
                                <div
                                    className={`rounded-lg border transition-opacity ${autoSelect ? 'opacity-50 pointer-events-none' : ''
                                        }`}
                                    data-testid="quant-table"
                                >
                                    {/* Header */}
                                    <div className="grid grid-cols-[2rem_1fr_4rem_5rem_1fr] gap-2 p-2 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                                        <span />
                                        <span>Quant</span>
                                        <span>Bits</span>
                                        <span>Size</span>
                                        <span>Description</span>
                                    </div>
                                    {/* Rows */}
                                    {useDynamicQuant
                                        ? modelInfo.ggufFiles.map((gf) => {
                                            const isSelected = selectedQuant === gf.quantization
                                            return (
                                                <div
                                                    key={gf.filename}
                                                    onClick={() => setSelectedQuant(gf.quantization)}
                                                    className={`grid grid-cols-[2rem_1fr_4rem_5rem_1fr] gap-2 p-2 cursor-pointer transition-colors border-b last:border-0
                                                        ${isSelected
                                                            ? 'ring-2 ring-primary bg-primary/10'
                                                            : 'hover:bg-muted/80'
                                                        }
                                                        ${gf.quantization === 'Q4_K_M' ? 'bg-primary/5' : ''}
                                                    `}
                                                    data-testid={`quant-row-${gf.quantization}`}
                                                    role="radio"
                                                    aria-checked={isSelected}
                                                >
                                                    {/* Radio dot */}
                                                    <div className="flex items-center justify-center">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                                                                ${isSelected
                                                                    ? 'border-primary'
                                                                    : 'border-muted-foreground/40'
                                                                }`}
                                                        >
                                                            {isSelected && (
                                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="font-mono text-xs flex items-center gap-2">
                                                        {gf.quantization}
                                                        {gf.quantization === 'Q4_K_M' && (
                                                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                                                Recommended
                                                            </Badge>
                                                        )}
                                                    </span>
                                                    <span className="text-sm">{gf.bits || '—'}</span>
                                                    <span className="text-sm">{gf.sizeBytes ? formatFileSize(gf.sizeBytes) : '—'}</span>
                                                    <span className="text-sm text-muted-foreground truncate" title={gf.filename}>
                                                        {gf.filename}
                                                    </span>
                                                </div>
                                            )
                                        })
                                        : QUANTIZATION_OPTIONS.map((q) => {
                                            const isSelected = selectedQuant === q.name
                                            return (
                                                <div
                                                    key={q.name}
                                                    onClick={() => setSelectedQuant(q.name)}
                                                    className={`grid grid-cols-[2rem_1fr_4rem_5rem_1fr] gap-2 p-2 cursor-pointer transition-colors border-b last:border-0
                                                        ${isSelected
                                                            ? 'ring-2 ring-primary bg-primary/10'
                                                            : 'hover:bg-muted/80'
                                                        }
                                                        ${q.recommended ? 'bg-primary/5' : ''}
                                                    `}
                                                    data-testid={`quant-row-${q.name}`}
                                                    role="radio"
                                                    aria-checked={isSelected}
                                                >
                                                    {/* Radio dot */}
                                                    <div className="flex items-center justify-center">
                                                        <div
                                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                                                                ${isSelected
                                                                    ? 'border-primary'
                                                                    : 'border-muted-foreground/40'
                                                                }`}
                                                        >
                                                            {isSelected && (
                                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="font-mono text-xs flex items-center gap-2">
                                                        {q.name}
                                                        {q.recommended && (
                                                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                                                Recommended
                                                            </Badge>
                                                        )}
                                                    </span>
                                                    <span className="text-sm">{q.bits}</span>
                                                    <span className="text-sm">{q.size}</span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {q.description}
                                                    </span>
                                                </div>
                                            )
                                        })}
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

                            {/* Model Info Card (dynamic) */}
                            <ModelInfoCard
                                model={modelInfo}
                                isLoading={modelInfoLoading}
                                error={modelInfoError}
                            />

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
                    data-testid="deploy-btn"
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

            {/* Deploy Terminal */}
            {logs.length > 0 && (
                <DeployTerminal
                    logs={logs}
                    status={status}
                    modelName={model}
                />
            )}

            {/* Interactive Prompt Dialog */}
            <PromptDialog
                prompt={pendingPrompt}
                onSend={sendInput}
                onDismiss={dismissPrompt}
            />
        </div>
    )
}
