"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { mutate } from "swr"
import {
  HeartIcon,
  MessageCircleIcon,
  Repeat2Icon,
  UserRoundPlusIcon,
} from "lucide-react"
import { markNotificationRead } from "@/app/actions/notifications"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn, formatRelativeTime, getInitials, profileHref } from "@/lib/utils"
import type { FeedNotification } from "@/lib/notifications"

const NOTIFICATION_META = {
  follow: {
    icon: UserRoundPlusIcon,
    iconClassName: "text-primary",
    message: "started following you",
  },
  like: {
    icon: HeartIcon,
    iconClassName: "text-rose-500",
    message: "liked your post",
  },
  reply: {
    icon: MessageCircleIcon,
    iconClassName: "text-primary",
    message: "replied to your post",
  },
  repost: {
    icon: Repeat2Icon,
    iconClassName: "text-emerald-500",
    message: "reposted your post",
  },
} as const

export function NotificationItem({
  notification,
}: {
  notification: FeedNotification
}) {
  const [isRead, setIsRead] = useState(notification.isRead)
  const [, startTransition] = useTransition()

  // Resync when the server sends fresh data (e.g. after "mark all read"
  // triggers a router.refresh()) — otherwise this already-mounted item
  // keeps whatever isRead it had at mount, since useState only reads its
  // initial value once and ignores later prop changes.
  useEffect(() => {
    setIsRead(notification.isRead)
  }, [notification.isRead])

  const meta = NOTIFICATION_META[notification.type]
  const Icon = meta.icon

  const href =
    notification.type === "follow"
      ? profileHref({ id: notification.actorId, username: notification.actorUsername })
      : `/post/${notification.postId}`

  function markRead() {
    if (isRead) return
    setIsRead(true)
    startTransition(async () => {
      const result = await markNotificationRead(notification.id)
      if (!result.success) {
        setIsRead(false)
        return
      }
      // Nudge the nav badge down immediately instead of waiting for
      // its next poll tick.
      mutate("/api/badges")
    })
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 border-b border-border p-4 transition-colors",
        !isRead && "bg-primary/5",
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-2 pt-0.5">
        <Icon className={cn("size-6", meta.iconClassName)} aria-hidden="true" />
      </div>

      <Link
        href={href}
        onClick={markRead}
        className="flex min-w-0 flex-1 flex-col gap-1"
      >
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage
              src={notification.actorImage ?? undefined}
              alt={notification.actorName}
            />
            <AvatarFallback className="text-[10px]">
              {getInitials(notification.actorName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm text-foreground">
            <span className="font-semibold">{notification.actorName}</span>{" "}
            <span className="text-muted-foreground">{meta.message}</span>
          </span>
        </div>

        {notification.postContent ? (
          <p className="line-clamp-2 text-pretty break-words text-sm leading-relaxed text-muted-foreground">
            {notification.postContent}
          </p>
        ) : null}

        <time
          dateTime={new Date(notification.createdAt).toISOString()}
          className="text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {formatRelativeTime(notification.createdAt)}
        </time>
      </Link>

      <div className="flex shrink-0 items-center pt-1">
        {!isRead ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mark as read"
            className="rounded-full text-primary hover:bg-primary/10"
            onClick={markRead}
          >
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
