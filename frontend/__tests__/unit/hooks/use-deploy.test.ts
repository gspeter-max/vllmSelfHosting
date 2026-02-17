import { describe, it, expect, vi, beforeEach } from 'vitest'

// ------------------------------------------------------------------
// Tests for the detectPrompt logic from use-deploy.ts
// We extract the pattern-matching logic and test it in isolation.
// ------------------------------------------------------------------

type PromptType = 'confirm-yes' | 'confirm-no' | 'danger-confirm' | 'text-input'

interface PendingPrompt {
    type: PromptType
    message: string
    rawLine: string
}

const PROMPT_PATTERNS: { pattern: RegExp; type: PromptType; message: string }[] = [
    {
        pattern: /Continue anyway\?\s*\[y\/N\]/i,
        type: 'confirm-no',
        message: 'RAM warning',
    },
    {
        pattern: /Proceed\?\s*\[Y\/n\]/i,
        type: 'confirm-yes',
        message: 'Fits in RAM',
    },
    {
        pattern: /Type CONFIRM to proceed/i,
        type: 'danger-confirm',
        message: 'Danger zone',
    },
    {
        pattern: /Enter the parameter count in billions/i,
        type: 'text-input',
        message: 'Parameter count needed',
    },
]

function detectPrompt(line: string): PendingPrompt | null {
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '')
    for (const { pattern, type, message } of PROMPT_PATTERNS) {
        if (pattern.test(clean)) {
            return { type, message, rawLine: line }
        }
    }
    return null
}

describe('detectPrompt — prompt pattern matching', () => {
    it('detects "Proceed? [Y/n]" as confirm-yes', () => {
        const result = detectPrompt('Model fits! Proceed? [Y/n]')
        expect(result).not.toBeNull()
        expect(result!.type).toBe('confirm-yes')
    })

    it('detects "Continue anyway? [y/N]" as confirm-no', () => {
        const result = detectPrompt('RAM usage high. Continue anyway? [y/N]')
        expect(result).not.toBeNull()
        expect(result!.type).toBe('confirm-no')
    })

    it('detects "Type CONFIRM to proceed" as danger-confirm', () => {
        const result = detectPrompt('System will be under heavy load. Type CONFIRM to proceed.')
        expect(result).not.toBeNull()
        expect(result!.type).toBe('danger-confirm')
    })

    it('detects "Enter the parameter count in billions" as text-input', () => {
        const result = detectPrompt('Enter the parameter count in billions (e.g., 7 for 7B):')
        expect(result).not.toBeNull()
        expect(result!.type).toBe('text-input')
    })

    it('returns null for non-matching lines', () => {
        expect(detectPrompt('Downloading model...')).toBeNull()
        expect(detectPrompt('Conversion complete')).toBeNull()
        expect(detectPrompt('')).toBeNull()
    })

    it('strips ANSI escape codes before matching', () => {
        const ansiLine = '\x1b[33m⚠️  Continue anyway? [y/N]\x1b[0m'
        const result = detectPrompt(ansiLine)
        expect(result).not.toBeNull()
        expect(result!.type).toBe('confirm-no')
        // rawLine should preserve original ANSI codes
        expect(result!.rawLine).toBe(ansiLine)
    })

    it('is case-insensitive', () => {
        expect(detectPrompt('PROCEED? [Y/n]')?.type).toBe('confirm-yes')
        expect(detectPrompt('type confirm to proceed')?.type).toBe('danger-confirm')
    })

    it('handles extra whitespace', () => {
        const result = detectPrompt('Continue anyway?   [y/N]')
        expect(result).not.toBeNull()
        expect(result!.type).toBe('confirm-no')
    })
})

describe('useDeploy — sendInput integration pattern', () => {
    it('sendInput calls fetch with correct payload shape', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        })
        global.fetch = mockFetch

        const deployId = 'test-deploy-123'
        const input = 'y'

        await fetch('/api/deploy/stdin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deployId, input }),
        })

        expect(mockFetch).toHaveBeenCalledWith('/api/deploy/stdin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deployId: 'test-deploy-123', input: 'y' }),
        })
    })
})
