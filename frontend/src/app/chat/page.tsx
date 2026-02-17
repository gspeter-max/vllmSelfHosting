'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useModels } from '@/hooks/use-models'
import { CHAT_STORAGE_KEY } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Send,
    Plus,
    Trash2,
    Bot,
    User,
    Loader2,
    MessageSquare,
} from 'lucide-react'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

interface Conversation {
    id: string
    title: string
    messages: ChatMessage[]
    model: string
    createdAt: number
}

export default function ChatPage() {
    const { models } = useModels()
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    // Load conversations from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(CHAT_STORAGE_KEY)
            if (stored) {
                const convos = JSON.parse(stored) as Conversation[]
                setConversations(convos)
                if (convos.length > 0) {
                    setActiveConvoId(convos[0].id)
                    setSelectedModel(convos[0].model)
                }
            }
        } catch {
            // ignore
        }
    }, [])

    // Save conversations to localStorage
    const saveConversations = useCallback(
        (convos: Conversation[]) => {
            setConversations(convos)
            try {
                localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(convos))
            } catch {
                // ignore
            }
        },
        [],
    )

    // Set default model when models load
    useEffect(() => {
        if (!selectedModel && models.length > 0) {
            setSelectedModel(models[0].name)
        }
    }, [models, selectedModel])

    const activeConvo = conversations.find((c) => c.id === activeConvoId)

    const createConversation = () => {
        const id = `conv-${Date.now()}`
        const newConvo: Conversation = {
            id,
            title: 'New Chat',
            messages: [],
            model: selectedModel || models[0]?.name || '',
            createdAt: Date.now(),
        }
        saveConversations([newConvo, ...conversations])
        setActiveConvoId(id)
    }

    const deleteConversation = (id: string) => {
        const updated = conversations.filter((c) => c.id !== id)
        saveConversations(updated)
        if (activeConvoId === id) {
            setActiveConvoId(updated[0]?.id || null)
        }
    }

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
        })
    }

    const sendMessage = async () => {
        if (!input.trim() || !selectedModel || isStreaming) return

        let convo = activeConvo
        if (!convo) {
            const id = `conv-${Date.now()}`
            convo = {
                id,
                title: input.trim().slice(0, 40),
                messages: [],
                model: selectedModel,
                createdAt: Date.now(),
            }
            setActiveConvoId(id)
        }

        const userMessage: ChatMessage = { role: 'user', content: input.trim() }
        const updatedMessages = [...convo.messages, userMessage]

        // Update title if first message
        const updatedConvo = {
            ...convo,
            messages: updatedMessages,
            title: convo.messages.length === 0 ? input.trim().slice(0, 40) : convo.title,
            model: selectedModel,
        }

        const updatedConvos = conversations.map((c) =>
            c.id === updatedConvo.id ? updatedConvo : c,
        )
        if (!conversations.find((c) => c.id === updatedConvo.id)) {
            updatedConvos.unshift(updatedConvo)
        }
        saveConversations(updatedConvos)
        setInput('')
        setIsStreaming(true)
        setStreamingContent('')
        scrollToBottom()

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    message: input.trim(),
                    conversationHistory: convo.messages,
                }),
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Chat failed' }))
                throw new Error(errData.error || 'Chat request failed')
            }

            const reader = res.body?.getReader()
            if (!reader) throw new Error('No stream')

            const decoder = new TextDecoder()
            let fullContent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = decoder.decode(value, { stream: true })
                const lines = text.split('\n').filter(Boolean)

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const chunk = JSON.parse(line.slice(6))
                        if (chunk.content) {
                            fullContent += chunk.content
                            setStreamingContent(fullContent)
                            scrollToBottom()
                        }
                    } catch {
                        // skip malformed
                    }
                }
            }

            // Save assistant message
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: fullContent,
            }
            const finalConvo = {
                ...updatedConvo,
                messages: [...updatedMessages, assistantMessage],
            }
            const finalConvos = updatedConvos.map((c) =>
                c.id === finalConvo.id ? finalConvo : c,
            )
            saveConversations(finalConvos)
        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
            }
            const errorConvo = {
                ...updatedConvo,
                messages: [...updatedMessages, errorMessage],
            }
            const errorConvos = updatedConvos.map((c) =>
                c.id === errorConvo.id ? errorConvo : c,
            )
            saveConversations(errorConvos)
        } finally {
            setIsStreaming(false)
            setStreamingContent('')
        }
    }

    const runningModels = models.filter((m) => m.status === 'running')

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-4">
            {/* Conversation sidebar */}
            <div className="w-64 shrink-0 flex flex-col gap-2">
                <Button onClick={createConversation} className="w-full" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    New Chat
                </Button>

                <ScrollArea className="flex-1">
                    <div className="space-y-1 pr-2">
                        {conversations.map((convo) => (
                            <div
                                key={convo.id}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer group transition-colors ${activeConvoId === convo.id
                                        ? 'bg-accent text-accent-foreground'
                                        : 'hover:bg-muted'
                                    }`}
                                onClick={() => {
                                    setActiveConvoId(convo.id)
                                    setSelectedModel(convo.model)
                                }}
                            >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate flex-1">{convo.title}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        deleteConversation(convo.id)
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col">
                {/* Model selector */}
                <div className="flex items-center gap-3 mb-4">
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-72">
                            <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map((m) => (
                                <SelectItem key={m.name} value={m.name}>
                                    <span className="flex items-center gap-2">
                                        {m.displayName || m.name}
                                        <Badge
                                            variant={m.status === 'running' ? 'default' : 'secondary'}
                                            className="text-[10px]"
                                        >
                                            {m.status}
                                        </Badge>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {runningModels.length === 0 && (
                        <p className="text-xs text-destructive">
                            No models running. Start a model first.
                        </p>
                    )}
                </div>

                {/* Messages */}
                <Card className="flex-1 overflow-hidden">
                    <CardContent className="p-0 h-full">
                        <ScrollArea className="h-full">
                            <div className="p-4 space-y-4">
                                {!activeConvo || activeConvo.messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                        <Bot className="h-12 w-12 mb-4 opacity-50" />
                                        <p className="text-lg font-medium">Start a conversation</p>
                                        <p className="text-sm">
                                            Select a model and type a message below
                                        </p>
                                    </div>
                                ) : (
                                    activeConvo.messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''
                                                }`}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                                    <Bot className="h-4 w-4 text-primary" />
                                                </div>
                                            )}
                                            <div
                                                className={`rounded-lg px-4 py-2.5 max-w-[70%] text-sm whitespace-pre-wrap ${msg.role === 'user'
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted'
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                                    <User className="h-4 w-4" />
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}

                                {/* Streaming indicator */}
                                {isStreaming && (
                                    <div className="flex gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                            <Bot className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="rounded-lg px-4 py-2.5 max-w-[70%] text-sm bg-muted whitespace-pre-wrap">
                                            {streamingContent || (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Input */}
                <div className="flex gap-2 mt-4">
                    <Input
                        placeholder="Type a message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        disabled={isStreaming || !selectedModel}
                    />
                    <Button
                        onClick={sendMessage}
                        disabled={isStreaming || !input.trim() || !selectedModel}
                    >
                        {isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
