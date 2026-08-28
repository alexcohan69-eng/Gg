import Link from "next/link"
import Image from "next/image"
import { BriefcaseIcon, MessageSquareQuoteIcon, PlayIcon, SparklesIcon } from "lucide-react"
import type { AttachedItemPreview } from "@/lib/posts"

const TYPE_META = {
  service: { label: "Service", icon: BriefcaseIcon },
  project: { label: "Case study", icon: SparklesIcon },
  testimonial: { label: "Testimonial", icon: MessageSquareQuoteIcon },
} as const

/**
 * Builds the profile-relative href for an attached item. Testimonials
 * have no detail page of their own (see TestimonialCard) — they link
 * to the Testimonials tab instead of a specific item.
 */
function attachmentHref(profileIdentifier: string, attachment: AttachedItemPreview): string {
  if (attachment.type === "service") return `/profile/${profileIdentifier}/services/${attachment.id}`
  if (attachment.type === "project") return `/profile/${profileIdentifier}/work/${attachment.id}`
  return `/profile/${profileIdentifier}/testimonials`
}

/**
 * Link-unfurl-style preview card rendered in a post's feed entry when
 * it showcases one of the author's own services/case studies/
 * testimonials (`post.attachment`, resolved server-side in
 * lib/posts.ts). Mirrors the compact info a `ServiceCard`/
 * `PortfolioProjectCard`/`TestimonialCard` shows, condensed to fit
 * inside a post.
 */
export function PostAttachmentCard({
  attachment,
  profileIdentifier,
}: {
  attachment: AttachedItemPreview
  profileIdentifier: string
}) {
  const { label, icon: TypeIcon } = TYPE_META[attachment.type]

  return (
    <Link
      href={attachmentHref(profileIdentifier, attachment)}
      className="mt-2 flex items-stretch gap-3 overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:bg-muted/40"
    >
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-muted sm:w-28">
        {attachment.image ? (
          attachment.imageType === "video" ? (
            <>
              <video
                src={attachment.image}
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 size-full object-cover"
                aria-hidden="true"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <PlayIcon className="size-5 fill-background text-background" aria-hidden="true" />
              </div>
            </>
          ) : (
            <Image
              src={attachment.image}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-muted">
            <TypeIcon className="size-6 text-primary" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2.5 pr-3">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase">
          <TypeIcon className="size-3" aria-hidden="true" />
          {label}
        </span>
        <p className="line-clamp-1 font-heading text-sm font-semibold tracking-tight text-foreground">
          {attachment.title}
        </p>
        {attachment.subtitle ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{attachment.subtitle}</p>
        ) : null}
        {attachment.meta ? (
          <p className="line-clamp-1 text-xs font-medium text-foreground">{attachment.meta}</p>
        ) : null}
      </div>
    </Link>
  )
}
