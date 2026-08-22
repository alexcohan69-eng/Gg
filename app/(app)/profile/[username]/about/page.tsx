import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import {
  CakeIcon,
  CalendarIcon,
  LinkIcon,
  MapPinIcon,
  MessageSquareTextIcon,
  UsersIcon,
} from "lucide-react"
import { getSessionWithRetry } from "@/lib/auth"
import { getFollowCounts, getProfileByIdentifier } from "@/lib/follows"
import { getUserPostCount } from "@/lib/posts"
import { profileHref } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { getInitials } from "@/lib/utils"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByIdentifier(username).catch(() => null)
  if (!profile) return { title: "About" }
  return { title: `About ${profile.name} (@${profile.username ?? "user"})` }
}

export default async function ProfileAboutPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfileByIdentifier(username)
  if (!profile) notFound()

  if (profile.username && profile.username !== username) {
    redirect(`${profileHref(profile)}/about`)
  }

  const isSelf = profile.id === session.user.id

  const [postCount, followCounts] = await Promise.all([
    getUserPostCount(profile.id),
    getFollowCounts(profile.id),
  ])

  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const details: { icon: typeof MapPinIcon; label: string; href?: string }[] = []
  if (profile.location) {
    details.push({ icon: MapPinIcon, label: profile.location })
  }
  if (profile.website) {
    details.push({
      icon: LinkIcon,
      label: profile.website.replace(/^https?:\/\//, ""),
      href: profile.website,
    })
  }
  details.push({ icon: CalendarIcon, label: `Joined ${joined}` })

  const stats = [
    { label: "Posts", value: postCount, icon: MessageSquareTextIcon },
    { label: "Followers", value: followCounts.followers, icon: UsersIcon },
    { label: "Following", value: followCounts.following, icon: UsersIcon },
  ]

  return (
    <div className="flex flex-col">
      <PageHeader
        title={profile.name}
        description="About this account"
        leading={<BackButton />}
      />

      <div className="flex flex-col gap-4 p-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <Avatar className="size-16">
              <AvatarImage src={profile.image ?? undefined} alt={profile.name} />
              <AvatarFallback className="text-xl">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                {profile.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                @{profile.username ?? "user"}
              </p>
            </div>
            {profile.bio ? (
              <p className="max-w-prose text-sm leading-relaxed text-foreground">
                {profile.bio}
              </p>
            ) : isSelf ? (
              <p className="text-sm text-muted-foreground">
                You haven&apos;t added a bio yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            {details.map((detail) => {
              const Icon = detail.icon
              const content = (
                <span className="inline-flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {detail.label}
                </span>
              )
              return (
                <div key={detail.label} className="text-sm">
                  {detail.href ? (
                    <a
                      href={detail.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:underline"
                    >
                      {content}
                    </a>
                  ) : (
                    <span className="text-foreground">{content}</span>
                  )}
                </div>
              )
            })}
            <div className="text-sm">
              <span className="inline-flex items-center gap-2 text-foreground">
                <CakeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                Account created {joined}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid grid-cols-3 gap-2 text-center">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="flex flex-col items-center gap-1 py-2">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
