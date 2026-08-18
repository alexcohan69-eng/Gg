import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { UserListItem } from "@/components/user-list-item"
import type { FollowListUser } from "@/lib/follows"
import type { LucideIcon } from "lucide-react"

/** Mirrors `PostList`'s shape/empty-state pattern for user rows. */
export function UserList({
  users,
  profileIdentifier,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  users: FollowListUser[]
  profileIdentifier: string
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
}) {
  if (users.length === 0) {
    return (
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <EmptyIcon />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {users.map((user) => (
        <UserListItem
          key={user.id}
          user={user}
          profileIdentifier={profileIdentifier}
        />
      ))}
    </div>
  )
}
