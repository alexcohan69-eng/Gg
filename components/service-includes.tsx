import { CheckIcon } from "lucide-react"
import type { ServicePackage } from "@/lib/services"

/**
 * "What you'll get" — a deliverables summary shown above the fold on the
 * reading column. Derived from the union of every package's feature list
 * so it stays accurate as packages change, with a generic fallback for
 * flat-price listings that have no packages at all.
 */
export function ServiceIncludes({
  packages,
  deliveryDays,
}: {
  packages: ServicePackage[]
  deliveryDays: number
}) {
  const items = deriveIncludes(packages, deliveryDays)
  if (items.length === 0) return null

  return (
    <div className="border-t border-border pt-6">
      <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight text-foreground">
        What you&apos;ll get
      </h2>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 text-sm text-foreground"
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CheckIcon className="size-2.5" aria-hidden="true" />
            </span>
            <span className="text-pretty leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function deriveIncludes(packages: ServicePackage[], deliveryDays: number): string[] {
  if (packages.length > 0) {
    const seen = new Set<string>()
    for (const pkg of packages) {
      for (const feature of pkg.features) {
        seen.add(feature)
      }
    }
    return Array.from(seen).slice(0, 8)
  }

  return [
    "Direct collaboration with the seller from brief to delivery",
    "Regular progress updates while the work is underway",
    `Delivery in ${deliveryDays} ${deliveryDays === 1 ? "day" : "days"}`,
    "Support after handoff until you're satisfied",
  ]
}
