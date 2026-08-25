import Link from "next/link"
import Image from "next/image"
import { BriefcaseIcon, ClockIcon, LayersIcon } from "lucide-react"
import type { Service } from "@/lib/services"
import { Badge } from "@/components/ui/badge"

/**
 * A single gig-style listing preview in the Services tab grid.
 * Purely presentational — owner controls (edit/delete/reorder) are
 * layered on top by the grid, not rendered here, so the same card
 * works for both the owner and any other viewer. Mirrors
 * PortfolioProjectCard's structure with a price + delivery footer
 * instead of a plain tagline card, closer to a Fiverr gig tile.
 */
export function ServiceCard({
  service,
  profileIdentifier,
}: {
  service: Service
  profileIdentifier: string
}) {
  // When pricing packages exist, lead with the cheapest tier's price
  // and fastest tier's delivery — the flat startingPrice/deliveryDays
  // fields are the fallback for listings without tiers.
  const displayPrice =
    service.packages.length > 0
      ? Math.min(...service.packages.map((pkg) => pkg.price))
      : service.startingPrice
  const displayDeliveryDays =
    service.packages.length > 0
      ? Math.min(...service.packages.map((pkg) => pkg.deliveryDays))
      : service.deliveryDays

  return (
    <Link
      href={`/profile/${profileIdentifier}/services/${service.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-ring/50 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {service.coverImage ? (
          service.coverImageType === "video" ? (
            <video
              src={service.coverImage}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              preload="auto"
              className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
              aria-hidden="true"
            />
          ) : (
            <Image
              src={service.coverImage}
              alt={`Cover ${service.coverImageType === "gif" ? "GIF" : "image"} for ${service.title}`}
              fill
              unoptimized
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BriefcaseIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        {/* Bottom gradient keeps the badges legible over busy cover media without a heavy scrim. */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/25 to-transparent" aria-hidden="true" />
        {service.category ? (
          <Badge
            variant="secondary"
            className="absolute top-2.5 left-2.5 max-w-[calc(100%-2.75rem)] truncate bg-background/90 text-foreground shadow-sm backdrop-blur-sm"
          >
            <span className="truncate">{service.category}</span>
          </Badge>
        ) : null}
        {/* Bottom-left, paired with the gradient scrim — the grid layers
            the owner's "..." menu at top-right, so the tiers pill lives
            here instead of risking a collision with it. */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          {service.coverImageType === "gif" ? (
            <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm">
              GIF
            </span>
          ) : null}
          {service.packages.length > 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
              <LayersIcon className="size-3" aria-hidden="true" />
              {service.packages.length} tiers
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-1 font-heading text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {service.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{service.tagline}</p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {displayDeliveryDays} {displayDeliveryDays === 1 ? "day" : "days"}
          </span>
          <span className="text-right">
            <span className="block text-[10px] leading-none text-muted-foreground">From</span>
            <span className="text-sm font-semibold text-foreground">${displayPrice.toLocaleString()}</span>
          </span>
        </div>
      </div>
    </Link>
  )
}
