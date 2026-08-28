import { QuoteIcon, StarIcon } from "lucide-react"
import type { Testimonial } from "@/lib/testimonials"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getInitials } from "@/lib/utils"

/**
 * A single client-quote card in the Testimonials tab grid. Purely
 * presentational — owner controls (edit/delete/reorder) are layered
 * on top by the grid, not rendered here, mirroring ServiceCard /
 * PortfolioProjectCard. Unlike those, a testimonial has no detail
 * page — the quote is short enough to live entirely on the card.
 */
export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-2">
        <QuoteIcon className="size-6 shrink-0 text-primary/30" aria-hidden="true" />
        {testimonial.rating ? (
          <div className="flex items-center gap-0.5" aria-label={`${testimonial.rating} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <StarIcon
                key={index}
                className={
                  index < testimonial.rating!
                    ? "size-3.5 fill-primary text-primary"
                    : "size-3.5 text-muted-foreground/30"
                }
                aria-hidden="true"
              />
            ))}
          </div>
        ) : null}
      </div>

      <p className="line-clamp-6 flex-1 text-sm leading-relaxed text-foreground text-pretty">
        {testimonial.content}
      </p>

      {testimonial.projectTitle ? (
        <Badge variant="secondary" className="w-fit border-none bg-muted text-muted-foreground">
          {testimonial.projectTitle}
        </Badge>
      ) : null}

      <div className="mt-auto flex items-center gap-3 border-t border-border/70 pt-4">
        <Avatar className="size-10">
          <AvatarImage src={testimonial.authorAvatar ?? undefined} alt={testimonial.authorName} />
          <AvatarFallback className="text-xs">{getInitials(testimonial.authorName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{testimonial.authorName}</p>
          {testimonial.authorTitle ? (
            <p className="truncate text-xs text-muted-foreground">{testimonial.authorTitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
