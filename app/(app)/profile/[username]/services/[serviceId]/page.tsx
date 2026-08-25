import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { getService } from "@/lib/services"
import { getProfileByIdentifier } from "@/lib/follows"
import { profileHref } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { ServiceDetail } from "@/components/service-detail"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; serviceId: string }>
}): Promise<Metadata> {
  const { username, serviceId } = await params
  const profile = await getProfileByIdentifier(username).catch(() => null)
  if (!profile) return { title: "Service" }

  const service = await getService(profile.id, serviceId).catch(() => null)
  if (!service) return { title: "Service" }

  return { title: `${service.title} — ${profile.name}` }
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ username: string; serviceId: string }>
}) {
  const { username, serviceId } = await params

  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const profile = await getProfileByIdentifier(username)
  if (!profile) notFound()

  if (profile.username && profile.username !== username) {
    redirect(`${profileHref(profile)}/services/${serviceId}`)
  }

  const service = await getService(profile.id, serviceId)
  if (!service) notFound()

  const isSelf = profile.id === session.user.id

  return (
    <div className="flex flex-col">
      <PageHeader title={service.title} leading={<BackButton />} />

      <ServiceDetail
        service={service}
        profileIdentifier={username}
        sellerId={profile.id}
        sellerName={profile.name}
        isSelf={isSelf}
      />
    </div>
  )
}
