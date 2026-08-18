import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/**
 * The public identifier to use when linking to a user's profile. Lives
 * here (not `lib/follows.ts`) because it's a pure string helper used
 * from client components like `PostCard` — `lib/follows.ts` imports
 * the server-only `db` client, which must never end up in a client bundle.
 */
export function profileHref(u: { username: string | null; id: string }) {
  return `/profile/${u.username ?? u.id}`
}

/** Twitter-style relative timestamp: 5s, 12m, 3h, 4d, then a short date. */
export function formatRelativeTime(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.max(0, (Date.now() - value.getTime()) / 1000)

  if (seconds < 60) return `${Math.floor(seconds)}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.floor(minutes)}m`
  const hours = minutes / 60
  if (hours < 24) return `${Math.floor(hours)}h`
  const days = hours / 24
  if (days < 7) return `${Math.floor(days)}d`

  const sameYear = value.getFullYear() === new Date().getFullYear()
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}
