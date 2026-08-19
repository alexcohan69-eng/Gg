import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { NewConversationSearch } from "@/components/new-conversation-search"

export const metadata: Metadata = {
  title: "New message",
}

export default async function NewMessagePage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  return (
    <div className="flex flex-col">
      <PageHeader title="New message" leading={<BackButton />} />
      <NewConversationSearch />
    </div>
  )
}
