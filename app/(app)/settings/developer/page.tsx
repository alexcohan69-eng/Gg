import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"
import { listApiKeys } from "@/lib/api-keys"
import { PageHeader } from "@/components/page-header"
import { BackButton } from "@/components/back-button"
import { ApiKeyManager } from "@/components/api-key-manager"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Developer settings",
}

export default async function DeveloperSettingsPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const keys = await listApiKeys(session.user.id)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Developer"
        description="API keys for building your own tools on Pulse"
        leading={<BackButton />}
      />

      <div className="flex flex-col gap-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Keys act as you — they can read public data and post, like, follow,
              and manage your own services, portfolio, and testimonials, but can
              never touch another account. See the{" "}
              <Link href="/developers" className="font-medium text-foreground underline">
                API docs
              </Link>{" "}
              for every available endpoint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeyManager initialKeys={keys} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>
              Base URL, authentication, and every endpoint with request/response examples.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" nativeButton={false} render={<Link href="/developers" />}>
              View API docs
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
