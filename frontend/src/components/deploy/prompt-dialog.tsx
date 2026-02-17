'use client'

import { useState } from 'react'
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, ShieldAlert, HelpCircle } from 'lucide-react'

export type PromptType = 'confirm-yes' | 'confirm-no' | 'danger-confirm' | 'text-input'

export interface PendingPrompt {
    type: PromptType
    message: string
    rawLine: string
}

interface PromptDialogProps {
    prompt: PendingPrompt | null
    onSend: (input: string) => void
    onDismiss: () => void
}

export function PromptDialog({ prompt, onSend, onDismiss }: PromptDialogProps) {
    const [textValue, setTextValue] = useState('')

    if (!prompt) return null

    const handleConfirm = () => {
        if (prompt.type === 'confirm-yes') {
            onSend('y')
        } else if (prompt.type === 'confirm-no') {
            onSend('y')
        } else if (prompt.type === 'danger-confirm') {
            onSend(textValue)
            setTextValue('')
        } else if (prompt.type === 'text-input') {
            onSend(textValue)
            setTextValue('')
        }
    }

    const handleCancel = () => {
        if (prompt.type === 'confirm-yes') {
            onSend('n')
        } else if (prompt.type === 'confirm-no') {
            onSend('n')
        } else if (prompt.type === 'danger-confirm') {
            onSend('cancel')
        } else {
            onDismiss()
        }
    }

    const isDanger = prompt.type === 'danger-confirm'
    const isTextInput = prompt.type === 'text-input'
    const isWarning = prompt.type === 'confirm-no'

    const Icon = isDanger ? ShieldAlert : isWarning ? AlertTriangle : HelpCircle
    const iconColor = isDanger
        ? 'text-red-500'
        : isWarning
            ? 'text-amber-500'
            : 'text-blue-500'

    const title = isDanger
        ? '🚨 Danger — High RAM Usage'
        : isWarning
            ? '⚠️ Warning — RAM Usage'
            : isTextInput
                ? 'Input Required'
                : 'ℹ️ Confirm'

    return (
        <AlertDialog open={!!prompt}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div
                            className={`p-2 rounded-full ${isDanger ? 'bg-red-500/10' : isWarning ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}
                        >
                            <Icon className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-sm leading-relaxed whitespace-pre-wrap">
                        {prompt.message}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {(isDanger || isTextInput) && (
                    <div className="py-2">
                        <Input
                            value={textValue}
                            onChange={(e) => setTextValue(e.target.value)}
                            placeholder={
                                isDanger
                                    ? 'Type CONFIRM to proceed'
                                    : 'Enter value...'
                            }
                            className={isDanger ? 'border-red-500/50 focus-visible:ring-red-500' : ''}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirm()
                            }}
                            autoFocus
                        />
                    </div>
                )}

                <AlertDialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        {isTextInput ? 'Cancel' : 'No'}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        variant={isDanger ? 'destructive' : 'default'}
                        disabled={
                            isDanger
                                ? textValue !== 'CONFIRM'
                                : isTextInput
                                    ? !textValue.trim()
                                    : false
                        }
                    >
                        {isDanger
                            ? 'Confirm'
                            : isTextInput
                                ? 'Submit'
                                : 'Yes'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
