import Link from "next/link"
import Image from "next/image"
import { ImageIcon } from "lucide-react"
import type { PortfolioProject } from "@/lib/portfolio"
import { Badge } from "@/components/ui/badge"

/**
 * A single case-study preview in the Work tab grid. Purely
 * presentational — owner controls (edit/delete/reorder) are layered
 * on top by the grid, not rendered here, so the same card works for
 * both the owner and any other viewer.
 */
export function PortfolioProjectCard({
  project,
  profileIdentifier,
}: {
  project: PortfolioProject
  profileIdentifier: string
}) {
  return (
    <Link
      href={`/profile/${profileIdentifier}/work/${project.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-ring"
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        {project.coverImage ? (
          <Image
            src={project.coverImage}
            alt={`Cover image for ${project.title}`}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-1 text-sm font-medium text-foreground">{project.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.tagline}</p>
        {project.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {project.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
