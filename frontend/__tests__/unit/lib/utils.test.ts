import { describe, it, expect } from 'vitest'
import {
    formatBytes,
    formatRelativeTime,
    sanitizeModelName,
    generateId,
    getDisplayName,
    getStatusColor,
} from '@/lib/utils'

describe('formatBytes', () => {
    it('formats 0 bytes', () => {
        expect(formatBytes(0)).toBe('0 B')
    })

    it('formats bytes to GB', () => {
        expect(formatBytes(1073741824)).toBe('1.00 GB')
    })

    it('formats bytes to MB', () => {
        expect(formatBytes(1048576)).toBe('1.00 MB')
    })

    it('handles negative values', () => {
        expect(formatBytes(-1)).toBe('Invalid')
    })
})

describe('formatRelativeTime', () => {
    it('returns "just now" for recent timestamps', () => {
        expect(formatRelativeTime(Date.now() - 5000)).toBe('just now')
    })

    it('returns minutes ago', () => {
        expect(formatRelativeTime(Date.now() - 120000)).toBe('2 minutes ago')
    })

    it('returns singular minute', () => {
        expect(formatRelativeTime(Date.now() - 60000)).toBe('1 minute ago')
    })

    it('returns hours ago', () => {
        expect(formatRelativeTime(Date.now() - 7200000)).toBe('2 hours ago')
    })
})

describe('sanitizeModelName', () => {
    it('keeps valid model names unchanged', () => {
        expect(sanitizeModelName('TinyLlama/TinyLlama-1.1B')).toBe(
            'TinyLlama/TinyLlama-1.1B'
        )
    })

    it('strips shell injection characters', () => {
        expect(sanitizeModelName('model; rm -rf /')).toBe('modelrm-rf/')
    })

    it('strips script tags', () => {
        expect(sanitizeModelName('<script>alert(1)</script>')).toBe(
            'scriptalert1/script'
        )
    })
})

describe('generateId', () => {
    it('returns a string', () => {
        expect(typeof generateId()).toBe('string')
    })

    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()))
        expect(ids.size).toBe(100)
    })
})

describe('getDisplayName', () => {
    it('extracts last part from HuggingFace path', () => {
        expect(getDisplayName('TinyLlama/TinyLlama-1.1B-Chat-v1.0')).toBe(
            'TinyLlama-1.1B-Chat-v1.0'
        )
    })

    it('returns name as-is if no slash', () => {
        expect(getDisplayName('tinyllama')).toBe('tinyllama')
    })
})

describe('getStatusColor', () => {
    it('returns green for running', () => {
        expect(getStatusColor('running')).toBe('bg-green-500')
    })

    it('returns red for stopped', () => {
        expect(getStatusColor('stopped')).toBe('bg-red-500')
    })

    it('returns gray for unknown', () => {
        expect(getStatusColor('unknown')).toBe('bg-gray-500')
    })
})
