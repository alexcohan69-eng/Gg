import Link from "next/link"
import Image from "next/image"
import { ArrowUpRightIcon, ImageIcon } from "lucide-react"
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-ring/60 hover:shadow-md"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {project.coverImage ? (
          <Image
            src={project.coverImage}
            alt={`Cover image for ${project.title}`}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute right-2.5 bottom-2.5 flex size-7 translate-y-1 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-1 font-heading text-sm font-semibold tracking-tight text-foreground">
          {project.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.tagline}</p>
        {project.tags.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
            {project.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[0.7rem] text-muted-foreground">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 2 ? (
              <Badge variant="outline" className="text-[0.7rem] text-muted-foreground">
                +{project.tags.length - 2}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
