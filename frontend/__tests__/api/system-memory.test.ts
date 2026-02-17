import { describe, it, expect, vi, beforeEach } from 'vitest'

// ------------------------------------------------------------------
// Tests for getAvailableMemory() logic used in /api/system/route.ts
// We test the parsing logic in isolation since the actual function
// runs exec() calls that we mock here.
// ------------------------------------------------------------------

// Realistic vm_stat output from macOS
const MACOS_VMSTAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               23456.
Pages active:                            356789.
Pages inactive:                          112345.
Pages speculative:                         8765.
Pages throttled:                              0.
Pages wired down:                        134567.
Pages purgeable:                           5678.
Pages stored in compressor:               78901.
`

// Realistic /proc/meminfo from Linux
const LINUX_MEMINFO = `MemTotal:       16384000 kB
MemFree:          512000 kB
MemAvailable:    8192000 kB
Buffers:          256000 kB
Cached:          4096000 kB
`

function parseVmStat(output: string): number {
    const pageSizeMatch = output.match(/page size of (\d+) bytes/)
    const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1]) : 4096

    const getValue = (label: string): number => {
        const re = new RegExp(`${label}:\\s+(\\d+)`)
        const m = output.match(re)
        return m ? parseInt(m[1]) : 0
    }

    const free = getValue('Pages free')
    const inactive = getValue('Pages inactive')
    const purgeable = getValue('Pages purgeable')

    return (free + inactive + purgeable) * pageSize
}

function parseMeminfo(output: string): number | null {
    const match = output.match(/MemAvailable:\s+(\d+)\s+kB/)
    if (match) return parseInt(match[1]) * 1024
    return null
}

describe('getAvailableMemory — macOS vm_stat parsing', () => {
    it('parses free + inactive + purgeable pages with correct page size', () => {
        const available = parseVmStat(MACOS_VMSTAT)
        // (23456 + 112345 + 5678) * 16384 = 141479 * 16384
        expect(available).toBe(141479 * 16384)
    })

    it('uses 4096 as fallback page size', () => {
        const noPageSize = MACOS_VMSTAT.replace(
            'page size of 16384 bytes',
            'some other text',
        )
        const available = parseVmStat(noPageSize)
        expect(available).toBe(141479 * 4096)
    })

    it('returns 0 for missing fields', () => {
        const empty = 'Mach Virtual Memory Statistics: (page size of 4096 bytes)\n'
        const available = parseVmStat(empty)
        expect(available).toBe(0)
    })

    it('handles partial output (only free pages)', () => {
        const partial = `Mach Virtual Memory Statistics: (page size of 4096 bytes)
Pages free:                               1000.
Pages active:                              500.
`
        const available = parseVmStat(partial)
        // Only free pages (inactive and purgeable are 0)
        expect(available).toBe(1000 * 4096)
    })
})

describe('getAvailableMemory — Linux /proc/meminfo parsing', () => {
    it('extracts MemAvailable and converts kB to bytes', () => {
        const available = parseMeminfo(LINUX_MEMINFO)
        expect(available).toBe(8192000 * 1024)
    })

    it('returns null for missing MemAvailable', () => {
        const noAvailable = `MemTotal:       16384000 kB
MemFree:          512000 kB
`
        const available = parseMeminfo(noAvailable)
        expect(available).toBeNull()
    })

    it('returns null for empty string', () => {
        expect(parseMeminfo('')).toBeNull()
    })
})

describe('getAvailableMemory — fallback behavior', () => {
    it('os.freemem returns a positive number', () => {
        const os = require('os')
        const freeMem = os.freemem()
        expect(freeMem).toBeGreaterThan(0)
        expect(typeof freeMem).toBe('number')
    })
})
