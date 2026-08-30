import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import {
  BriefcaseIcon,
  CalendarIcon,
  FolderCheckIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react"
import { getSessionWithRetry } from "@/lib/auth"
import { getCareerProfile, getWorkExperience } from "@/lib/career"
import { getProfileByIdentifier, isFollowing } from "@/lib/follows"
import { getBlockState } from "@/lib/blocks"
import { getAverageRating } from "@/lib/testimonials"
import { profileHref } from "@/lib/utils"
import { ProfileStickyHeader } from "@/components/profile-sticky-header"
import { BackButton } from "@/components/back-button"
import { ProfileHeader } from "@/components/profile-header"
import { ProfileTabs } from "@/components/profile-tabs"
import { ProfileAboutBio } from "@/components/profile-about-bio"
import {
  ProfileAboutCareerHighlights,
  type CareerHighlight,
} from "@/components/profile-about-career-highlights"
import { ProfileAboutSkills } from "@/components/profile-about-skills"
import { ProfileAboutWorkflow } from "@/components/profile-about-workflow"
import { ProfileAboutExperience } from "@/components/profile-about-experience"
import { ProfileAboutDetails, type AboutDetail } from "@/components/profile-about-details"
import { ProfileAboutCta } from "@/components/profile-about-cta"

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

  const [viewerFollows, careerProfile, workExperience, rating, blockState] = await Promise.all([
    isSelf ? Promise.resolve(false) : isFollowing(session.user.id, profile.id),
    getCareerProfile(profile.id),
    getWorkExperience(profile.id),
    getAverageRating(profile.id),
    isSelf
      ? Promise.resolve({ viewerBlockedTarget: false, targetBlockedViewer: false })
      : getBlockState(session.user.id, profile.id),
  ])

  const careerHighlights: CareerHighlight[] = []
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

  const memberSince = formatMonthYear(profile.createdAt)
  const websiteLabel = profile.website?.replace(/^https?:\/\//, "").replace(/\/$/, "")

  const details: AboutDetail[] = []
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
      <ProfileStickyHeader
        name={profile.name}
        username={profile.username ?? "user"}
        leading={<BackButton />}
      />

      <ProfileHeader
        name={profile.name}
        username={profile.username}
        bio={profile.bio}
        image={profile.image}
        bannerImage={profile.bannerImage}
        website={profile.website}
        location={profile.location}
        joined={memberSince}
        rating={rating}
        totalProjects={careerProfile.totalProjects}
        profileIdentifier={profile.username ?? profile.id}
        isSelf={isSelf}
        targetUserId={profile.id}
        targetUserName={profile.name}
        isFollowing={viewerFollows}
        viewerBlockedTarget={blockState.viewerBlockedTarget}
        targetBlockedViewer={blockState.targetBlockedViewer}
      />

      <ProfileTabs identifier={profile.username ?? profile.id} current="about" />

      <div className="flex flex-col gap-5 p-4">
        <ProfileAboutBio about={profile.about} isSelf={isSelf} name={profile.name} />

        <ProfileAboutCareerHighlights highlights={careerHighlights} isSelf={isSelf} />

        <ProfileAboutSkills skills={careerProfile.skills} isSelf={isSelf} />

        <ProfileAboutWorkflow steps={careerProfile.workflowSteps} isSelf={isSelf} />

        <ProfileAboutExperience entries={workExperience} isSelf={isSelf} />

        <ProfileAboutDetails details={details} />

        <ProfileAboutCta
          isSelf={isSelf}
          name={profile.name}
          targetUserId={profile.id}
          viewerFollows={viewerFollows}
          profileIdentifier={profile.username ?? profile.id}
        />
      </div>
    </div>
  )
}
