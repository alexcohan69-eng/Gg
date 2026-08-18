"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field"
import { Logo } from "@/components/logo"
import { Spinner } from "@/components/ui/spinner"

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

function slugifyUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20)
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === "sign-up"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setUsernameError(null)

    if (isSignUp && !USERNAME_PATTERN.test(username)) {
      setUsernameError(
        "Use 3-20 characters: lowercase letters, numbers, and underscores only.",
      )
      return
    }

    setLoading(true)

    const { error } = isSignUp
      ? await authClient.signUp.email({
          email,
          password,
          name,
          username,
        } as Parameters<typeof authClient.signUp.email>[0])
      : await authClient.signIn.email({ email, password })

    setLoading(false)

    if (error) {
      const message = error.message ?? "Something went wrong"
      if (/username/i.test(message)) {
        setUsernameError("That username is already taken.")
      } else {
        setError(message)
      }
      return
    }

    router.push("/home")
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp
              ? "Join Pulse and start the conversation."
              : "Sign in to continue to your feed."}
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {isSignUp && (
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Jordan Lee"
                />
              </Field>
            )}

            {isSignUp && (
              <Field data-invalid={usernameError ? true : undefined}>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) =>
                    setUsername(slugifyUsername(e.target.value))
                  }
                  required
                  autoComplete="off"
                  aria-invalid={usernameError ? true : undefined}
                  placeholder="jordanlee"
                />
                {usernameError ? (
                  <FieldError>{usernameError}</FieldError>
                ) : (
                  <FieldDescription>
                    Your public handle: @{username || "username"}
                  </FieldDescription>
                )}
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder="••••••••"
              />
              {isSignUp && (
                <FieldDescription>At least 8 characters.</FieldDescription>
              )}
            </Field>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Spinner data-icon="inline-start" />}
              {loading
                ? "Please wait..."
                : isSignUp
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <Link
            href={isSignUp ? "/sign-in" : "/sign-up"}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </div>
    </main>
  )
}
