'use client'

import { usePathname } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { ModeToggle } from '@/components/layout/mode-toggle'

const pageTitles: Record<string, string> = {
    '/': 'Dashboard',
    '/deploy': 'Deploy Model',
    '/models': 'Model Management',
    '/chat': 'Chat',
    '/system': 'System Information',
}

export function Header() {
    const pathname = usePathname()
    const title = pageTitles[pathname] ?? 'LLM Dashboard'

    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <h1 className="text-sm font-semibold">{title}</h1>
            <div className="ml-auto flex items-center gap-2">
                <ModeToggle />
            </div>
        </header>
    )
}
