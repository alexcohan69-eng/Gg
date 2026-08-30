import { cn } from "@/lib/utils"

export function Logo({
  className,
  iconOnly = false,
}: {
  className?: string
  iconOnly?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-heading text-xl font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-4 text-primary-foreground"
          aria-hidden="true"
        >
          <path
            d="M3 12h4l2.5-7 4 14L16 12h5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {iconOnly ? <span className="sr-only">Web Banai</span> : "Web Banai"}
    </span>
  )
}
