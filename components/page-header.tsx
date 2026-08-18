import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  className,
  leading,
  children,
}: {
  title: string
  description?: string
  className?: string
  /** Optional element rendered before the title, e.g. a back button. */
  leading?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {leading}
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </header>
  )
}
