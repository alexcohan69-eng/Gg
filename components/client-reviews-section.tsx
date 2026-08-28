import Link from "next/link"
import { ArrowRightIcon, MessageSquareQuoteIcon } from "lucide-react"
import type { Testimonial } from "@/lib/testimonials"
import { TestimonialCard } from "@/components/testimonial-card"

/**
 * Read-only "Client reviews" section shown at the bottom of a service
 * or portfolio project's detail page — the testimonials the owner
 * linked to that specific listing (see lib/testimonials.ts's
 * getTestimonialsForService/Project). Editing still happens on the
 * Testimonials tab; this is purely a display surface, so it renders
 * for every viewer, not just the owner. Renders nothing when the
 * listing has no linked testimonials yet.
 */
export function ClientReviewsSection({
  testimonials,
  profileIdentifier,
}: {
  testimonials: Testimonial[]
  profileIdentifier: string
}) {
  if (testimonials.length === 0) return null

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight text-foreground">
          <MessageSquareQuoteIcon className="size-4 text-primary" aria-hidden="true" />
          Client reviews
        </h2>
        <Link
          href={`/profile/${profileIdentifier}/testimonials`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          See all
          <ArrowRightIcon className="size-3" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>
    </div>
  )
}
