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

export async function GET() {
    try {
        const platform = os.platform()
        const arch = os.arch()
        const cpuCores = os.cpus().length
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const hostname = os.hostname()

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
                ramTotal: formatBytes(totalMem),
                ramTotalBytes: totalMem,
                ramAvailable: formatBytes(freeMem),
                ramAvailableBytes: freeMem,
                ramUsed: formatBytes(usedMem),
                ramUsedBytes: usedMem,
                hostname,
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
