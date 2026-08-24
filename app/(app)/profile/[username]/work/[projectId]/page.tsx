import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getPortfolioProject } from "@/lib/portfolio"
import { getProfileByIdentifier } from "@/lib/follows"
import { profileHref } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { PortfolioProjectDetail } from "@/components/portfolio-project-detail"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; projectId: string }>
}): Promise<Metadata> {
  const { username, projectId } = await params
  const profile = await getProfileByIdentifier(username).catch(() => null)
  if (!profile) return { title: "Project" }

  const project = await getPortfolioProject(profile.id, projectId).catch(() => null)
  if (!project) return { title: "Project" }

  return { title: `${project.title} — ${profile.name}` }
}

export default async function PortfolioProjectPage({
  params,
}: {
  params: Promise<{ username: string; projectId: string }>
}) {
  const { username, projectId } = await params

  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfileByIdentifier(username)
  if (!profile) notFound()

  if (profile.username && profile.username !== username) {
    redirect(`${profileHref(profile)}/work/${projectId}`)
  }

  const project = await getPortfolioProject(profile.id, projectId)
  if (!project) notFound()

  const isSelf = profile.id === session.user.id

  return (
    <div className="flex flex-col">
      <PageHeader title={project.title} leading={<BackButton />} />

      <PortfolioProjectDetail
        project={project}
        profileIdentifier={username}
        isSelf={isSelf}
      />
    </div>
  )
}
