import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

async function runCommand(cmd: string): Promise<string> {
    try {
        const { stdout } = await execAsync(cmd, { timeout: 5000 })
        return stdout.trim()
    } catch {
        return ''
    }
}

/**
 * Get accurate "available" memory in bytes.
 *
 * os.freemem() on macOS only reports truly free pages, ignoring
 * inactive + purgeable memory that the OS can reclaim instantly.
 * This makes RAM look ~99% used when actual usage is ~60%.
 *
 * - macOS:  parse `vm_stat` → (free + inactive + purgeable) × pageSize
 * - Linux:  parse `/proc/meminfo` → MemAvailable
 * - fallback: os.freemem()
 */
async function getAvailableMemory(): Promise<number> {
    const platform = os.platform()

    if (platform === 'darwin') {
        const output = await runCommand('vm_stat')
        if (output) {
            // First line: "Mach Virtual Memory Statistics: (page size of XXXX bytes)"
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

            const availableBytes = (free + inactive + purgeable) * pageSize
            if (availableBytes > 0) return availableBytes
        }
    }

    if (platform === 'linux') {
        const output = await runCommand('cat /proc/meminfo')
        if (output) {
            // MemAvailable: 12345678 kB
            const match = output.match(/MemAvailable:\s+(\d+)\s+kB/)
            if (match) return parseInt(match[1]) * 1024
        }
    }

    // Fallback
    return os.freemem()
}

async function detectGpu(): Promise<{
    name: string
    vramTotalMB: number
    vramUsedMB: number
    vramFreeMB: number
    utilization: number
    temperature: number
} | null> {
    const platform = os.platform()

    // 1. macOS (Apple Silicon / Metal / AMD)
    if (platform === 'darwin') {
        try {
            // Get GPU info
            const spOutput = await runCommand('system_profiler SPDisplaysDataType -json')
            const spData = JSON.parse(spOutput)
            const gpus = spData.SPDisplaysDataType || []

            // Find the best GPU (Prefer AMD/Apple Silicon over Intel)
            const bestGpu = gpus.find((g: any) => {
                const model = (g.sppci_model || '').toLowerCase()
                return model.includes('amd') || model.includes('radeon') || model.includes('apple')
            }) || gpus[0]

            if (bestGpu) {
                // If VRAM is "4 GB", parse it. If "1536 MB", parse it.
                // spdisplays_vram: "4 GB"
                let vramTotal = 0
                const vramStr = bestGpu.spdisplays_vram || bestGpu.spdisplays_vram_shared || ''
                if (vramStr) {
                    const parts = vramStr.split(' ')
                    const val = parseFloat(parts[0])
                    if (parts[1] === 'GB') vramTotal = val * 1024
                    else if (parts[1] === 'MB') vramTotal = val
                }

                return {
                    name: bestGpu.sppci_model || 'Unknown GPU',
                    vramTotalMB: vramTotal,
                    vramUsedMB: 0, // Hard to get without sudo
                    vramFreeMB: 0,
                    utilization: 0,
                    temperature: 0,
                }
            }
        } catch {
            // Fallback
        }
    }

    // 2. NVIDIA (Linux / Windows)
    const csv = await runCommand(
        'nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu --format=csv,noheader,nounits',
    )
    if (csv) {
        // Parse first GPU line: "NVIDIA GeForce RTX 3090, 24576, 1234, 23342, 15, 42"
        const parts = csv.split('\n')[0]?.split(',').map((s) => s.trim())
        if (parts && parts.length >= 6) {
            return {
                name: parts[0],
                vramTotalMB: parseFloat(parts[1]) || 0,
                vramUsedMB: parseFloat(parts[2]) || 0,
                vramFreeMB: parseFloat(parts[3]) || 0,
                utilization: parseFloat(parts[4]) || 0,
                temperature: parseFloat(parts[5]) || 0,
            }
        }
    }

    return null
}

async function getVllmKvCache(): Promise<number | null> {
    try {
        const res = await fetch('http://localhost:8104/metrics', {
            signal: AbortSignal.timeout(2000),
        })
        if (!res.ok) return null
        const text = await res.text()
        const match = text.match(/vllm:kv_cache_usage_perc\s+([\d.]+)/)
        if (match) return parseFloat(match[1])
        return null
    } catch {
        return null
    }
}

export async function GET() {
    try {
        const platform = os.platform()
        const arch = os.arch()
        const cpuCores = os.cpus().length
        const totalMem = os.totalmem()
        const availableMem = await getAvailableMemory()
        const usedMem = totalMem - availableMem
        const hostname = os.hostname()

        // CPU load: 1-min load average / number of cores * 100 → percentage
        const loadAvg = os.loadavg()[0]
        const cpuLoad = Math.min(100, Math.round((loadAvg / cpuCores) * 100))

        // Detect OS name
        let osName: string = platform
        if (platform === 'darwin') {
            const version = await runCommand('sw_vers -productVersion')
            osName = `macOS ${version}`.trim()
        } else if (platform === 'linux') {
            const prettyName = await runCommand(
                'cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'',
            )
            osName = prettyName || 'Linux'
        }

        // Detect CPU model
        let cpuModel = os.cpus()[0]?.model || 'Unknown'
        cpuModel = cpuModel.replace(/\s+/g, ' ').trim()

        // Detect GPU (nvidia-smi)
        const gpu = await detectGpu()

        // Get vLLM KV cache metric (if vLLM is running)
        const vllmKvCachePercent = gpu ? await getVllmKvCache() : null

        const formatBytes = (bytes: number): string => {
            const gb = bytes / (1024 * 1024 * 1024)
            return `${gb.toFixed(1)} GB`
        }

        return NextResponse.json({
            success: true,
            data: {
                os: osName,
                arch,
                cpu: cpuModel,
                cpuCores,
                cpuLoad,
                ramTotal: formatBytes(totalMem),
                ramTotalBytes: totalMem,
                ramAvailable: formatBytes(availableMem),
                ramAvailableBytes: availableMem,
                ramUsed: formatBytes(usedMem),
                ramUsedBytes: usedMem,
                hostname,
                gpu,
                vllmKvCachePercent,
            },
        })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get system info',
            },
            { status: 500 },
        )
    }
}
