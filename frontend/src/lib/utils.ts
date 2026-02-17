import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind class merge utility (from shadcn/ui) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format bytes to human readable string.
 * @example formatBytes(1073741824) → "1.00 GB"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  if (bytes < 0) return 'Invalid'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const index = Math.min(i, sizes.length - 1)
  return `${(bytes / Math.pow(k, index)).toFixed(decimals)} ${sizes[index]}`
}

/**
 * Format a timestamp to a relative time string.
 * @example formatRelativeTime(Date.now() - 60000) → "1 minute ago"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 0) return 'just now'

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

/**
 * Sanitize model name for safe display.
 * Strips any potentially dangerous characters.
 */
export function sanitizeModelName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-/:]/g, '')
}

/**
 * Generate a unique ID for chat messages, conversations, etc.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Extracts a short display name from a HuggingFace model path.
 * @example getDisplayName("TinyLlama/TinyLlama-1.1B-Chat-v1.0") → "TinyLlama-1.1B-Chat-v1.0"
 */
export function getDisplayName(modelName: string): string {
  const parts = modelName.split('/')
  return parts[parts.length - 1] || modelName
}

/**
 * Get the status color class based on model status.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-green-500'
    case 'stopped':
      return 'bg-red-500'
    case 'loading':
      return 'bg-yellow-500'
    case 'error':
      return 'bg-red-600'
    default:
      return 'bg-gray-500'
  }
}
