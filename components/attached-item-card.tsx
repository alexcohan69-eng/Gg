import Link from "next/link"
import Image from "next/image"
import { BriefcaseIcon, ClockIcon, ImageIcon, QuoteIcon, StarIcon } from "lucide-react"
import type { AttachedItem } from "@/lib/posts"
import { cn } from "@/lib/utils"

/**
 * Compact bordered preview of a service/work project/testimonial
 * embedded in a post — deliberately smaller than the full
 * ServiceCard/PortfolioProjectCard/TestimonialCard tiles used on the
 * profile grids, since it sits inside a feed item rather than being
 * the primary content on the page. Links to the item's real page;
 * testimonials have none, so they link to the owner's Testimonials tab.
 */
export function AttachedItemCard({
  attached,
  profileIdentifier,
  disableLink = false,
}: {
  attached: AttachedItem
  profileIdentifier: string
  /** True inside the composer's own preview, where the card is a static mockup, not a real link. */
  disableLink?: boolean
}) {
  const href =
    attached.kind === "service"
      ? `/profile/${profileIdentifier}/services/${attached.id}`
      : attached.kind === "project"
        ? `/profile/${profileIdentifier}/work/${attached.id}`
        : `/profile/${profileIdentifier}/testimonials`

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card/50 p-2.5 transition-colors",
        !disableLink && "hover:border-primary/40 hover:bg-card",
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {attached.kind === "testimonial" ? (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/60">
            <QuoteIcon className="size-5 text-primary/40" aria-hidden="true" />
          </div>
        ) : attached.coverImage ? (
          attached.coverImageType === "video" ? (
            <video
              src={attached.coverImage}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full object-cover"
              aria-hidden="true"
            />
          ) : (
            <Image
              src={attached.coverImage}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          )
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/60">
            {attached.kind === "service" ? (
              <BriefcaseIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {attached.kind === "testimonial" ? (
          <>
            <p className="line-clamp-2 text-sm leading-snug text-foreground">
              &ldquo;{attached.content}&rdquo;
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate font-medium">{attached.authorName}</span>
              {attached.rating ? (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <StarIcon className="size-3 fill-primary text-primary" aria-hidden="true" />
                  {attached.rating}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="line-clamp-1 text-sm font-semibold text-foreground">{attached.title}</p>
            {attached.kind === "service" ? (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  From ${attached.startingPrice.toLocaleString()}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="size-3" aria-hidden="true" />
                  {attached.deliveryDays} {attached.deliveryDays === 1 ? "day" : "days"}
                </span>
              </div>
            ) : (
              <p className="line-clamp-1 text-xs text-muted-foreground">{attached.tagline}</p>
            )}
          </>
        )}
      </div>
    </div>
  )

  if (disableLink) return content

  return (
    <Link href={href} className="block" onClick={(e) => e.stopPropagation()}>
      {content}
    </Link>
  )
}
