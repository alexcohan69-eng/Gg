"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { HeartIcon, MessageCircleIcon, Repeat2Icon, UserPlusIcon } from "lucide-react"
import { markNotificationRead } from "@/app/actions/notifications"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, getInitials, formatRelativeTime, profileHref } from "@/lib/utils"
import type { NotificationItem as NotificationItemType } from "@/lib/notifications"

const TYPE_CONFIG = {
  follow: {
    icon: UserPlusIcon,
    iconClassName: "text-primary",
    label: "followed you",
  },
  like: {
    icon: HeartIcon,
    iconClassName: "text-rose-500",
    label: "liked your post",
  },
  reply: {
    icon: MessageCircleIcon,
    iconClassName: "text-sky-500",
    label: "replied to your post",
  },
  repost: {
    icon: Repeat2Icon,
    iconClassName: "text-emerald-500",
    label: "reposted your post",
  },
} as const

/**
 * A single notification row. Clicking it marks the notification read
 * (optimistically, fire-and-forget) and navigates to the relevant
 * target: the actor's profile for a follow, or the related post's
 * thread for a like/reply/repost.
 */
export function NotificationItem({
  notification,
}: {
  notification: NotificationItemType
}) {
  const [isRead, setIsRead] = useState(notification.isRead)
  const [, startTransition] = useTransition()

  const config = TYPE_CONFIG[notification.type]
  const Icon = config.icon

  const href =
    notification.type === "follow"
      ? profileHref({ id: notification.actorId, username: notification.actorUsername })
      : notification.postId
        ? `/post/${notification.postId}`
        : "/notifications"

  function handleClick() {
    if (isRead) return
    setIsRead(true)
    startTransition(async () => {
      await markNotificationRead(notification.id)
    })
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "flex gap-3 border-b border-border p-4 transition-colors hover:bg-muted/30",
        !isRead && "bg-primary/5",
      )}
    >
      <div className="flex shrink-0 flex-col items-center gap-2">
        <Icon className={cn("size-5", config.iconClassName)} aria-hidden="true" />
        <Avatar className="size-9">
          <AvatarImage
            src={notification.actorImage ?? undefined}
            alt={notification.actorName}
          />
          <AvatarFallback>{getInitials(notification.actorName)}</AvatarFallback>
        </Avatar>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-pretty break-words text-sm leading-relaxed text-foreground">
          <span className="font-semibold">{notification.actorName}</span>{" "}
          <span className="text-muted-foreground">{config.label}</span>
        </p>
        {notification.postContent ? (
          <p className="mt-0.5 line-clamp-2 text-pretty break-words text-sm text-muted-foreground">
            {notification.postContent}
          </p>
        ) : null}
        <time
          dateTime={new Date(notification.createdAt).toISOString()}
          className="mt-1 text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {formatRelativeTime(notification.createdAt)}
        </time>
      </div>

      {!isRead ? (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
          aria-label="Unread"
        />
      ) : null}
    </Link>
  )
}
