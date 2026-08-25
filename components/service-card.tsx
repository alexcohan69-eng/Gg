import Link from "next/link"
import Image from "next/image"
import { BriefcaseIcon, ClockIcon } from "lucide-react"
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
  return (
    <Link
      href={`/profile/${profileIdentifier}/services/${service.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-ring/60 hover:shadow-md"
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
        {service.coverImageType === "gif" ? (
          <span className="absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm">
            GIF
          </span>
        ) : null}
        {service.category ? (
          <Badge
            variant="secondary"
            className="absolute top-2.5 left-2.5 bg-background/90 text-foreground backdrop-blur-sm"
          >
            {service.category}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-1 font-heading text-sm font-semibold tracking-tight text-foreground">
          {service.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{service.tagline}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {service.deliveryDays} {service.deliveryDays === 1 ? "day" : "days"}
          </span>
          <span className="text-sm font-semibold text-foreground">
            From ${service.startingPrice.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  )
}
