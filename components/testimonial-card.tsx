"use client"

import { useState } from "react"
import Image from "next/image"
import { PlayIcon, QuoteIcon, StarIcon } from "lucide-react"
import type { Testimonial } from "@/lib/testimonials"
import { sanitizePostHtml } from "@/lib/sanitize-html"
import { MediaLightbox } from "@/components/media-lightbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getInitials } from "@/lib/utils"

/**
 * A single client-quote card in the Testimonials tab grid (and the
 * "Client reviews" section on a linked service/project's detail
 * page). Purely presentational — owner controls (edit/delete/reorder)
 * are layered on top by the grid, not rendered here, mirroring
 * ServiceCard/PortfolioProjectCard. Unlike those, a testimonial has
 * no detail page of its own — the quote is short enough to live
 * entirely on the card.
 */
export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Defense-in-depth: re-sanitize before dangerouslySetInnerHTML, same
  // as the Work tab's case-study render (the server action already
  // sanitizes at write time).
  const contentHtml = sanitizePostHtml(testimonial.content)

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

      <div
        className="prose-post line-clamp-6 flex-1 text-sm leading-relaxed text-foreground text-pretty"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {testimonial.projectTitle ? (
        <Badge variant="secondary" className="w-fit border-none bg-muted text-muted-foreground">
          {testimonial.projectTitle}
        </Badge>
      ) : null}

      {testimonial.media.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5">
          {testimonial.media.map((item, index) => (
            <button
              key={item.url}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`View proof media ${index + 1} from ${testimonial.authorName}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {item.type === "video" ? (
                <>
                  <video src={item.url} muted playsInline preload="metadata" className="size-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <PlayIcon className="size-3 fill-background text-background" aria-hidden="true" />
                  </div>
                </>
              ) : (
                <Image
                  src={item.url}
                  alt={`Proof media ${index + 1} from ${testimonial.authorName}`}
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </button>
          ))}
        </div>
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

      <MediaLightbox
        items={testimonial.media}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
        altPrefix={`${testimonial.authorName}'s testimonial`}
      />
    </div>
  )
}
