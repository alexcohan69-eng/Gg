import { getSessionWithRetry } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"

export default async function SignInPage() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (session?.user) redirect("/home")
  return <AuthForm mode="sign-in" />
}
