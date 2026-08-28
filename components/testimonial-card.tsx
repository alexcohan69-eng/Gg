"use client"

import { useState } from "react"
import Image from "next/image"
import { BriefcaseIcon, PlayIcon, StarIcon } from "lucide-react"
import type { Testimonial } from "@/lib/testimonials"
import { sanitizePostHtml } from "@/lib/sanitize-html"
import { MediaLightbox } from "@/components/media-lightbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
    <div className="group/card relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
      {/* Signature element: an oversized serif quotation mark, the one
          decorative flourish this card gets — everything else stays quiet. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 right-5 font-heading text-7xl leading-none text-primary/10 transition-colors duration-300 group-hover/card:text-primary/15"
      >
        &rdquo;
      </span>

      <div className="flex items-start justify-between gap-3">
        {testimonial.rating ? (
          <div
            className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1"
            aria-label={`${testimonial.rating} out of 5 stars`}
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <StarIcon
                key={index}
                className={
                  index < testimonial.rating!
                    ? "size-3.5 fill-primary text-primary"
                    : "size-3.5 fill-transparent text-primary/25"
                }
                aria-hidden="true"
              />
            ))}
          </div>
        ) : (
          <span />
        )}

        {testimonial.projectTitle ? (
          <span className="inline-flex max-w-[60%] items-center gap-1.5 truncate rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <BriefcaseIcon className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{testimonial.projectTitle}</span>
          </span>
        ) : null}
      </div>

      <div
        className="prose-post relative line-clamp-6 flex-1 text-[15px] leading-relaxed text-foreground text-pretty"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {testimonial.media.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {testimonial.media.map((item, index) => (
            <button
              key={item.url}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`View proof media ${index + 1} from ${testimonial.authorName}`}
              className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted"
            >
              {item.type === "video" ? (
                <>
                  <video src={item.url} muted playsInline preload="metadata" className="size-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <PlayIcon className="size-8 fill-background text-background" aria-hidden="true" />
                  </div>
                </>
              ) : (
                <Image
                  src={item.url}
                  alt={
                    item.type === "gif"
                      ? `GIF ${index + 1} from ${testimonial.authorName}`
                      : `Proof media ${index + 1} from ${testimonial.authorName}`
                  }
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              {item.type === "gif" ? (
                <span className="absolute bottom-1.5 left-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm">
                  GIF
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-3 border-t border-border/70 pt-5">
        <Avatar className="size-11 ring-2 ring-primary/15">
          <AvatarImage src={testimonial.authorAvatar ?? undefined} alt={testimonial.authorName} />
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {getInitials(testimonial.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold tracking-tight text-foreground">
            {testimonial.authorName}
          </p>
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
