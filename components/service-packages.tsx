"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckIcon, ClockIcon, ShoppingBagIcon } from "lucide-react"
import { startConversation } from "@/app/actions/messages"
import type { ServicePackage } from "@/lib/services"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"

/** Optional add-ons offered on every listing, priced as a percentage of the selected tier so they scale with the order size. */
const EXTRAS = [
  { id: "rush", label: "Rush delivery", detail: "Cut the delivery time roughly in half", rate: 0.25 },
  { id: "revision", label: "Extra revision round", detail: "One additional round beyond what's included", rate: 0.12 },
  { id: "source", label: "Source files & assets", detail: "Editable source files handed over with delivery", rate: 0.15 },
] as const

function ExtrasList({
  basePrice,
  selected,
  onToggle,
}: {
  basePrice: number
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-4">
      <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Add extras
      </p>
      {EXTRAS.map((extra) => {
        const cost = Math.round(basePrice * extra.rate)
        const checked = selected.has(extra.id)
        return (
          <label
            key={extra.id}
            className="group/field flex cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2 hover:bg-muted/50"
          >
            <Checkbox checked={checked} onCheckedChange={() => onToggle(extra.id)} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{extra.label}</span>
                <span className="shrink-0 text-sm font-semibold text-foreground">+${cost}</span>
              </span>
              <span className="block text-xs text-muted-foreground text-pretty">{extra.detail}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/**
 * The service detail page's pricing/booking panel. Renders a
 * Basic/Standard/Premium tab switcher when the listing has pricing
 * packages, each with its own price, delivery estimate, description,
 * and feature checklist — Fiverr-gig style. Falls back to the flat
 * starting-price/delivery display for listings without packages.
 * Every tier also offers optional priced add-ons that roll into the
 * order total shown on the "Order now" button.
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
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set())

  function toggleExtra(id: string) {
    setSelectedExtras((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function extrasTotal(basePrice: number) {
    let total = 0
    for (const extra of EXTRAS) {
      if (selectedExtras.has(extra.id)) {
        total += Math.round(basePrice * extra.rate)
      }
    }
    return total
  }

  function handleOrder() {
    startContacting(async () => {
      const result = await startConversation(sellerId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Order request sent to ${sellerName.split(" ")[0]}`)
      router.push(`/messages/${result.data.conversationId}`)
    })
  }

  if (packages.length === 0) {
    const total = fallbackPrice + extrasTotal(fallbackPrice)
    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Starting at</p>
            <p className="mt-1 font-heading text-3xl font-semibold tracking-tight text-foreground">
              ${fallbackPrice.toLocaleString()}
            </p>
          </div>
          <div className="h-10 w-px bg-border" aria-hidden="true" />
          <div className="flex-1">
            <p className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <ClockIcon className="size-3.5" aria-hidden="true" />
              Delivery
            </p>
            <p className="mt-1 font-heading text-3xl font-semibold tracking-tight text-foreground">
              {fallbackDeliveryDays} {fallbackDeliveryDays === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
        {!isSelf ? (
          <>
            <ExtrasList basePrice={fallbackPrice} selected={selectedExtras} onToggle={toggleExtra} />
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Total</span>
                <span className="font-heading text-lg font-semibold text-foreground">
                  ${total.toLocaleString()}
                </span>
              </div>
              <Button type="button" size="lg" className="w-full" disabled={isContacting} onClick={handleOrder}>
                {isContacting ? <Spinner data-icon="inline-start" /> : <ShoppingBagIcon data-icon="inline-start" />}
                Order now
              </Button>
            </div>
          </>
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
              className="h-10 flex-1 justify-center rounded-lg text-sm font-semibold data-active:bg-background data-active:text-primary data-active:shadow-sm"
            >
              {pkg.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {packages.map((pkg) => {
          const total = pkg.price + extrasTotal(pkg.price)
          return (
            <TabsContent key={pkg.name} value={pkg.name} className="flex flex-col gap-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                    ${pkg.price.toLocaleString()}
                  </p>
                  {pkg.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                      {pkg.description}
                    </p>
                  ) : null}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <ClockIcon className="size-3.5" aria-hidden="true" />
                  {pkg.deliveryDays} {pkg.deliveryDays === 1 ? "day" : "days"}
                </span>
              </div>

              {pkg.features.length > 0 ? (
                <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-pretty">{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!isSelf ? (
                <>
                  <ExtrasList basePrice={pkg.price} selected={selectedExtras} onToggle={toggleExtra} />
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-muted-foreground">Total for {pkg.name}</span>
                      <span className="font-heading text-lg font-semibold text-foreground">
                        ${total.toLocaleString()}
                      </span>
                    </div>
                    <Button type="button" size="lg" className="w-full" disabled={isContacting} onClick={handleOrder}>
                      {isContacting ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <ShoppingBagIcon data-icon="inline-start" />
                      )}
                      Order now
                    </Button>
                  </div>
                </>
              ) : null}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
