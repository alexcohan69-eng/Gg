"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, ClockIcon, MailIcon } from "lucide-react"
import { startConversation } from "@/app/actions/messages"
import type { ServicePackage } from "@/lib/services"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"

/**
 * The service detail page's pricing/booking panel. Renders a
 * Basic/Standard/Premium tab switcher when the listing has pricing
 * packages, each with its own price, delivery estimate, description,
 * and feature checklist — Fiverr-gig style. Falls back to the flat
 * starting-price/delivery display for listings without packages.
 */
export function ServicePackages({
  packages,
  sellerId,
  sellerName,
  isSelf,
  fallbackPrice,
  fallbackDeliveryDays,
}: {
  packages: ServicePackage[]
  sellerId: string
  sellerName: string
  isSelf: boolean
  fallbackPrice: number
  fallbackDeliveryDays: number
}) {
  const router = useRouter()
  const [isContacting, startContacting] = useTransition()
  const [active, setActive] = useState(packages[0]?.name)

  function handleContact() {
    startContacting(async () => {
      const result = await startConversation(sellerId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      router.push(`/messages/${result.data.conversationId}`)
    })
  }

  if (packages.length === 0) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground">Starting at</p>
            <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              ${fallbackPrice.toLocaleString()}
            </p>
          </div>
          <div className="h-10 w-px bg-border" aria-hidden="true" />
          <div className="flex-1">
            <p className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <ClockIcon className="size-3.5" aria-hidden="true" />
              Delivery
            </p>
            <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              {fallbackDeliveryDays} {fallbackDeliveryDays === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
        {!isSelf ? (
          <Button type="button" size="lg" disabled={isContacting} onClick={handleContact}>
            {isContacting ? <Spinner data-icon="inline-start" /> : <MailIcon data-icon="inline-start" />}
            Contact {sellerName.split(" ")[0]}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Tabs value={active} onValueChange={(v) => setActive(v as string)} className="gap-0">
        <TabsList variant="line" className="h-auto w-full justify-between gap-1 border-b border-border bg-muted/40 p-1.5">
          {packages.map((pkg) => (
            <TabsTrigger
              key={pkg.name}
              value={pkg.name}
              className="h-10 flex-1 justify-center rounded-lg text-sm font-semibold data-active:bg-background data-active:shadow-sm"
            >
              {pkg.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {packages.map((pkg) => (
          <TabsContent key={pkg.name} value={pkg.name} className="flex flex-col gap-4 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                  ${pkg.price.toLocaleString()}
                </p>
                {pkg.description ? (
                  <p className="mt-1 text-sm text-muted-foreground text-pretty">{pkg.description}</p>
                ) : null}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <ClockIcon className="size-3.5" aria-hidden="true" />
                {pkg.deliveryDays} {pkg.deliveryDays === 1 ? "day" : "days"}
              </span>
            </div>

            {pkg.features.length > 0 ? (
              <ul className="flex flex-col gap-2 border-t border-border pt-3">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-sm text-foreground">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-pretty">{feature}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {!isSelf ? (
              <Button type="button" size="lg" disabled={isContacting} onClick={handleContact}>
                {isContacting ? <Spinner data-icon="inline-start" /> : <MailIcon data-icon="inline-start" />}
                Book the {pkg.name} tier
              </Button>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
