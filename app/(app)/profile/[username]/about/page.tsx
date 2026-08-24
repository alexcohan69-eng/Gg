import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import {
  ArrowUpRightIcon,
  AtSignIcon,
  BadgeCheckIcon,
  BriefcaseIcon,
  CalendarIcon,
  FolderCheckIcon,
  GlobeIcon,
  ListChecksIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareTextIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"
import { getSessionWithRetry } from "@/lib/auth"
import { getCareerProfile, getWorkExperience } from "@/lib/career"
import { getFollowCounts, getProfileByIdentifier, isFollowing } from "@/lib/follows"
import { getUserPostCount } from "@/lib/posts"
import { getInitials, profileHref } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { FollowButton } from "@/components/follow-button"
import { MessageButton } from "@/components/message-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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

/** "January 2025" — used for the "member since" line. */
function formatMonthYear(date: Date) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })
}

/** Human tenure on the platform, e.g. "2 years", "5 months", "New here". */
function formatTenure(date: Date) {
  const months = Math.floor(
    (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  )
  if (months < 1) return "New here"
  if (months < 12) return `${months} mo${months === 1 ? "" : "s"}`
  const years = Math.floor(months / 12)
  return `${years} yr${years === 1 ? "" : "s"}`
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

  const [postCount, followCounts, viewerFollows, careerProfile, workExperience] =
    await Promise.all([
      getUserPostCount(profile.id),
      getFollowCounts(profile.id),
      isSelf ? Promise.resolve(false) : isFollowing(session.user.id, profile.id),
      getCareerProfile(profile.id),
      getWorkExperience(profile.id),
    ])

  const careerHighlights: { label: string; value: string; icon: typeof BriefcaseIcon }[] = []
  if (careerProfile.yearsExperience != null) {
    careerHighlights.push({
      label: careerProfile.yearsExperience === 1 ? "Year of experience" : "Years of experience",
      value: careerProfile.yearsExperience.toLocaleString(),
      icon: BriefcaseIcon,
    })
  }
  if (careerProfile.totalClients != null) {
    careerHighlights.push({
      label: careerProfile.totalClients === 1 ? "Client" : "Clients",
      value: careerProfile.totalClients.toLocaleString(),
      icon: UsersIcon,
    })
  }
  if (careerProfile.totalProjects != null) {
    careerHighlights.push({
      label: careerProfile.totalProjects === 1 ? "Project" : "Projects",
      value: careerProfile.totalProjects.toLocaleString(),
      icon: FolderCheckIcon,
    })
  }

  const joinedFull = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const memberSince = formatMonthYear(profile.createdAt)
  const websiteLabel = profile.website?.replace(/^https?:\/\//, "").replace(/\/$/, "")

  const stats = [
    { label: "Posts", value: postCount.toLocaleString(), icon: MessageSquareTextIcon },
    { label: "Followers", value: followCounts.followers.toLocaleString(), icon: UsersIcon },
    { label: "Following", value: followCounts.following.toLocaleString(), icon: UsersIcon },
    { label: "On Pulse", value: formatTenure(profile.createdAt), icon: SparklesIcon },
  ]

  const details: {
    key: string
    icon: typeof MapPinIcon
    label: string
    value: string
    href?: string
  }[] = []
  if (profile.location) {
    details.push({
      key: "location",
      icon: MapPinIcon,
      label: "Location",
      value: profile.location,
    })
  }
  if (profile.website && websiteLabel) {
    details.push({
      key: "website",
      icon: GlobeIcon,
      label: "Website",
      value: websiteLabel,
      href: profile.website,
    })
  }
  if (isSelf && session.user.email) {
    details.push({
      key: "email",
      icon: MailIcon,
      label: "Email",
      value: session.user.email,
    })
  }
  details.push({
    key: "joined",
    icon: CalendarIcon,
    label: "Member since",
    value: memberSince,
  })

  return (
    <div className="flex flex-col">
      <PageHeader
        title={profile.name}
        description="About this account"
        leading={<BackButton />}
      />

      <div className="flex flex-col gap-5 p-4">
        {/* Hero — banner, avatar, identity, and primary actions */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div
            className="h-28 w-full bg-gradient-to-br from-primary/40 via-accent to-primary/10 sm:h-36"
            style={
              profile.bannerImage
                ? {
                    backgroundImage: `url(${profile.bannerImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
            aria-hidden="true"
          />

          <div className="px-5 pb-5">
            <div className="-mt-12 flex items-end justify-between gap-3">
              <Avatar className="size-24 border-4 border-card">
                <AvatarImage src={profile.image ?? undefined} alt={profile.name} />
                <AvatarFallback className="text-2xl">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>

              <div className="mb-1 flex items-center gap-2">
                {isSelf ? (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    nativeButton={false}
                    render={<a href="/settings" />}
                  >
                    Edit profile
                  </Button>
                ) : (
                  <>
                    <MessageButton targetUserId={profile.id} />
                    <FollowButton
                      targetUserId={profile.id}
                      initialIsFollowing={viewerFollows}
                      profileIdentifier={profile.username ?? profile.id}
                      size="default"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
                  {profile.name}
                </h2>
                <BadgeCheckIcon
                  className="size-5 shrink-0 text-primary"
                  aria-label="Verified member"
                />
              </div>
              <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <AtSignIcon className="size-3.5" aria-hidden="true" />
                {profile.username ?? "user"}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Open to connections
                </span>
                {profile.location ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    <MapPinIcon className="size-3.5" aria-hidden="true" />
                    {profile.location}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  <CalendarIcon className="size-3.5" aria-hidden="true" />
                  Since {memberSince}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights — portfolio-style metrics strip */}
        <section
          aria-label="Highlights"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            )
          })}
        </section>

        {/* About — narrative bio */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            About
          </h3>
          {profile.bio ? (
            <p className="mt-3 whitespace-pre-line text-pretty text-base leading-relaxed text-foreground">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {isSelf
                ? "You haven't added a bio yet. Add one from settings to introduce yourself."
                : `${profile.name} hasn't written a bio yet.`}
            </p>
          )}
          {isSelf && !profile.bio ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Add a bio
            </Button>
          ) : null}
        </section>

        {/* Career highlights — years of experience, clients, projects */}
        {careerHighlights.length > 0 ? (
          <section
            aria-label="Career highlights"
            className="grid grid-cols-3 gap-3"
          >
            {careerHighlights.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
                    {stat.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
              )
            })}
          </section>
        ) : isSelf ? (
          <section className="rounded-2xl border border-dashed border-border bg-card/50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Career highlights
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Add your years of experience, client count, and project count from
              settings to show a metrics strip here.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Add career highlights
            </Button>
          </section>
        ) : null}

        {/* Skills */}
        {careerProfile.skills.length > 0 ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Skills
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {careerProfile.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="rounded-full px-3 py-1">
                  {skill}
                </Badge>
              ))}
            </div>
          </section>
        ) : isSelf ? (
          <section className="rounded-2xl border border-dashed border-border bg-card/50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Skills
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              List the skills you want visitors to see first.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Add skills
            </Button>
          </section>
        ) : null}

        {/* Workflow */}
        {careerProfile.workflowSteps.length > 0 ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workflow
            </h3>
            <ol className="mt-4 flex flex-col gap-4">
              {careerProfile.workflowSteps.map((step, index) => (
                <li key={`${step.title}-${index}`} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    {step.description ? (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : isSelf ? (
          <section className="rounded-2xl border border-dashed border-border bg-card/50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workflow
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Outline the steps you take clients through, from kickoff to
              delivery.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Add workflow steps
            </Button>
          </section>
        ) : null}

        {/* Experience — career timeline */}
        {workExperience.length > 0 ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Experience
            </h3>
            <ol className="mt-4 flex flex-col">
              {workExperience.map((entry, index) => (
                <li key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <ListChecksIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                    {index < workExperience.length - 1 ? (
                      <span
                        className="my-1 w-px flex-1 bg-border"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {entry.role}
                        <span className="text-muted-foreground"> · {entry.company}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.startDate} — {entry.isCurrent ? "Present" : entry.endDate ?? "Present"}
                      </p>
                    </div>
                    {entry.description ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : isSelf ? (
          <section className="rounded-2xl border border-dashed border-border bg-card/50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Experience
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Add your past roles to build out your career timeline.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Add experience
            </Button>
          </section>
        ) : null}

        {/* Details — contact / info list */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Details
          </h3>
          <dl className="mt-4 flex flex-col divide-y divide-border">
            {details.map((detail) => {
              const Icon = detail.icon
              return (
                <div
                  key={detail.key}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                    <dd className="truncate text-sm font-medium text-foreground">
                      {detail.href ? (
                        <a
                          href={detail.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {detail.value}
                          <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
                        </a>
                      ) : (
                        detail.value
                      )}
                    </dd>
                  </div>
                </div>
              )
            })}
          </dl>
        </section>

        {/* Get in touch — closing call to action */}
        {!isSelf ? (
          <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Get in touch
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a conversation or follow {profile.name.split(" ")[0]} to stay
                in the loop.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MessageButton targetUserId={profile.id} />
              <FollowButton
                targetUserId={profile.id}
                initialIsFollowing={viewerFollows}
                profileIdentifier={profile.username ?? profile.id}
                size="default"
              />
            </div>
          </section>
        ) : (
          <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Make it yours
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Update your bio, links, and details to complete your profile.
              </p>
            </div>
            <Button
              className="rounded-full"
              nativeButton={false}
              render={<a href="/settings" />}
            >
              Edit profile
            </Button>
          </section>
        )}
      </div>
    </div>
  )
}
