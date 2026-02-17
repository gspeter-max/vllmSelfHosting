'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import Ansi from 'ansi-to-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    CheckCircle,
    XCircle,
    Loader2,
    Copy,
    Trash2,
    ArrowDown,
} from 'lucide-react'
import type { DeployEvent } from '@/lib/types'

interface DeployTerminalProps {
    logs: DeployEvent[]
    status: 'idle' | 'deploying' | 'completed' | 'failed'
    modelName: string
}

export function DeployTerminal({ logs, status, modelName }: DeployTerminalProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [autoScroll, setAutoScroll] = useState(true)
    const [copied, setCopied] = useState(false)
    const [startTime] = useState(Date.now())
    const [elapsed, setElapsed] = useState(0)

    // Elapsed timer
    useEffect(() => {
        if (status !== 'deploying') return
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [status, startTime])

    // Auto-scroll on new logs
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current?.scrollIntoView?.({ behavior: 'smooth' })
        }
    }, [logs, autoScroll])

    // Detect manual scroll-up to pause auto-scroll
    const handleScroll = useCallback(() => {
        if (!containerRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current
        const atBottom = scrollHeight - scrollTop - clientHeight < 40
        setAutoScroll(atBottom)
    }, [])

    const jumpToBottom = useCallback(() => {
        setAutoScroll(true)
        scrollRef.current?.scrollIntoView?.({ behavior: 'smooth' })
    }, [])

    const copyLogs = useCallback(async () => {
        const text = logs
            .filter((l) => l.type !== 'complete')
            .map((l) => l.data)
            .join('\n')
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [logs])

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60)
        const sec = s % 60
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`
    }

    // Filter out 'complete' events from display
    const displayLogs = logs.filter((l) => l.type !== 'complete')

    // Detect prompt lines that require user input
    const isPromptLine = (text: string): 'warning' | 'danger' | 'info' | null => {
        const clean = text.replace(/\x1b\[[0-9;]*m/g, '')
        if (/Continue anyway\?\s*\[y\/N\]/i.test(clean)) return 'warning'
        if (/Type CONFIRM to proceed/i.test(clean)) return 'danger'
        if (/Proceed\?\s*\[Y\/n\]/i.test(clean)) return 'info'
        if (/Enter the parameter count/i.test(clean)) return 'info'
        return null
    }

    return (
        <div className="rounded-lg overflow-hidden border border-[#30363d]" data-testid="deploy-terminal">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
                <Badge
                    variant={
                        status === 'completed'
                            ? 'default'
                            : status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                    }
                    data-testid="terminal-status-badge"
                >
                    {status === 'completed' ? (
                        <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Complete
                        </span>
                    ) : status === 'failed' ? (
                        <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Failed
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Running
                        </span>
                    )}
                </Badge>
                {status === 'deploying' && (
                    <span className="text-xs text-muted-foreground font-mono">
                        {formatElapsed(elapsed)}
                    </span>
                )}
            </div>

            {/* macOS title bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1c2128]">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
                    <span className="text-xs text-[#8b949e] font-mono ml-3" data-testid="terminal-model-name">
                        Deployment — {modelName || 'Model'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#8b949e] hover:text-white"
                        onClick={copyLogs}
                        data-testid="terminal-copy-btn"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Terminal body */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="bg-[#0d1117] overflow-y-auto max-h-[450px] relative"
                data-testid="terminal-body"
            >
                <div className="p-3 font-mono text-[13px] leading-5">
                    {displayLogs.length === 0 ? (
                        <div className="text-[#484f58] italic">Waiting for output...</div>
                    ) : (
                        displayLogs.map((log, i) => {
                            const promptLevel = isPromptLine(log.data)
                            const promptClass = promptLevel === 'danger'
                                ? 'bg-red-500/15 border-l-2 border-red-500 animate-pulse'
                                : promptLevel === 'warning'
                                    ? 'bg-amber-500/15 border-l-2 border-amber-500 animate-pulse'
                                    : promptLevel === 'info'
                                        ? 'bg-blue-500/10 border-l-2 border-blue-500'
                                        : ''

                            return (
                                <div key={i} className={`flex hover:bg-[#161b22] rounded ${promptClass}`}>
                                    <span
                                        className="select-none text-[#484f58] text-right pr-4 shrink-0"
                                        style={{ minWidth: '3rem' }}
                                        data-testid="line-number"
                                    >
                                        {i + 1}
                                    </span>
                                    <span
                                        className={
                                            log.type === 'error'
                                                ? 'text-[#f85149]'
                                                : 'text-[#c9d1d9]'
                                        }
                                    >
                                        <Ansi>{log.data}</Ansi>
                                    </span>
                                </div>
                            )
                        })
                    )}
                    <div ref={scrollRef} />
                </div>

                {/* Jump to bottom button */}
                {!autoScroll && (
                    <button
                        onClick={jumpToBottom}
                        className="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#30363d] text-[#c9d1d9] text-xs hover:bg-[#484f58] transition-colors"
                        data-testid="jump-to-bottom"
                    >
                        <ArrowDown className="h-3 w-3" />
                        Jump to bottom
                    </button>
                )}
            </div>
        </div>
    )
}
