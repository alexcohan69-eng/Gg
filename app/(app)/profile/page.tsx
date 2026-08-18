import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getUserPosts } from "@/lib/posts"
import { PageHeader } from "@/components/page-header"
import { PostList } from "@/components/post-list"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  CalendarIcon,
  LinkIcon,
  MapPinIcon,
  MessageSquareTextIcon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Your profile",
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const user = session.user as typeof session.user & {
    username?: string | null
    bio?: string | null
    bannerImage?: string | null
    website?: string | null
    location?: string | null
  }

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })

  const posts = await getUserPosts(user.id, user.id)

  return (
    <div className="flex flex-col">
      <PageHeader title={user.name} description={`@${user.username ?? "user"}`} />

      <div
        className="h-36 w-full bg-gradient-to-br from-primary/40 via-accent to-primary/10 sm:h-48"
        style={
          user.bannerImage
            ? {
                backgroundImage: `url(${user.bannerImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      <div className="px-4 pb-6">
        <div className="-mt-10 flex items-end justify-between sm:-mt-12">
          <Avatar className="size-20 border-4 border-background sm:size-24">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback className="text-2xl">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="outline"
            className="mt-10 rounded-full sm:mt-12"
            nativeButton={false}
            render={<a href="/settings" />}
          >
            Edit profile
          </Button>
        </div>

        <div className="mt-4 space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {user.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            @{user.username ?? "user"}
          </p>
        </div>

        {user.bio ? (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground">
            {user.bio}
          </p>
        ) : (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Add a bio to tell people about yourself.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {user.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-4" aria-hidden="true" />
              {user.location}
            </span>
          ) : null}
          {user.website ? (
            <a
              href={user.website}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <LinkIcon className="size-4" aria-hidden="true" />
              {user.website.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-4" aria-hidden="true" />
            Joined {joined}
          </span>
        </div>

        <div className="mt-4 flex gap-5 text-sm">
          <span>
            <strong className="font-semibold text-foreground">0</strong>{" "}
            <span className="text-muted-foreground">Following</span>
          </span>
          <span>
            <strong className="font-semibold text-foreground">0</strong>{" "}
            <span className="text-muted-foreground">Followers</span>
          </span>
        </div>
      </div>

      <div className="border-t border-border">
        <PostList
          posts={posts}
          currentUserId={user.id}
          emptyIcon={MessageSquareTextIcon}
          emptyTitle="No posts yet"
          emptyDescription="Anything you post will show up here."
        />
      </div>
    </div>
  )
}
