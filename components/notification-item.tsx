import Link from "next/link"
import {
  HeartIcon,
  MessageCircleIcon,
  Repeat2Icon,
  UserRoundPlusIcon,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, formatRelativeTime, getInitials, profileHref } from "@/lib/utils"
import type { NotificationItem as NotificationItemData } from "@/lib/notifications"

const TYPE_META: Record<
  NotificationItemData["type"],
  { icon: LucideIcon; iconClassName: string; text: string }
> = {
  follow: {
    icon: UserRoundPlusIcon,
    iconClassName: "bg-primary text-primary-foreground",
    text: "followed you",
  },
  like: {
    icon: HeartIcon,
    iconClassName: "bg-rose-500 text-white",
    text: "liked your post",
  },
  reply: {
    icon: MessageCircleIcon,
    iconClassName: "bg-sky-500 text-white",
    text: "replied to your post",
  },
  repost: {
    icon: Repeat2Icon,
    iconClassName: "bg-emerald-500 text-white",
    text: "reposted your post",
  },
}

function notificationHref(notification: NotificationItemData) {
  if (notification.type === "follow") return profileHref(notification.actor)
  if (notification.postId) return `/post/${notification.postId}`
  return profileHref(notification.actor)
}

export function NotificationItem({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: NotificationItemData
  /** Fired when the row itself is activated (click-through + mark read). */
  onOpen: (id: string) => void
  /** Fired by the standalone unread dot — marks read without navigating. */
  onMarkRead: (id: string) => void
}) {
  const { icon: Icon, iconClassName, text } = TYPE_META[notification.type]

  return (
    <div
      className={cn(
        "group flex items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/30",
        !notification.isRead && "bg-primary/5",
      )}
    >
      <Link
        href={notificationHref(notification)}
        onClick={() => onOpen(notification.id)}
        className="flex min-w-0 flex-1 items-start gap-3"
      >
        <div className="relative shrink-0">
          <Avatar className="size-10">
            <AvatarImage
              src={notification.actor.image ?? undefined}
              alt={notification.actor.name}
            />
            <AvatarFallback>
              {getInitials(notification.actor.name)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-background",
              iconClassName,
            )}
            aria-hidden="true"
          >
            <Icon className="size-3" fill={notification.type === "like" ? "currentColor" : "none"} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-foreground">
            <span className="font-semibold">{notification.actor.name}</span>{" "}
            <span className="text-muted-foreground">@{notification.actor.username ?? "user"}</span>{" "}
            <span>{text}</span>
          </p>
          {notification.postExcerpt ? (
            <p className="mt-0.5 line-clamp-2 text-pretty break-words text-sm text-muted-foreground">
              {notification.postExcerpt}
            </p>
          ) : null}
          <time
            dateTime={new Date(notification.createdAt).toISOString()}
            className="mt-1 block text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {formatRelativeTime(notification.createdAt)}
          </time>
        </div>
      </Link>

      {!notification.isRead ? (
        <button
          type="button"
          onClick={() => onMarkRead(notification.id)}
          aria-label="Mark as read"
          className="mt-1.5 flex shrink-0 items-center justify-center rounded-full p-2 -m-2 text-primary"
        >
          <span className="size-2 rounded-full bg-primary" />
        </button>
      ) : null}
    </div>
  )
}
