import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { SearchExperience } from "@/components/search-experience"

export const metadata: Metadata = {
  title: "Explore",
}

export default async function ExplorePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  return (
    <div className="flex flex-col">
      <PageHeader title="Explore" description="Search people and posts" />
      <SearchExperience currentUserId={session.user.id} />
    </div>
  )
}
