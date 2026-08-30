import { LockIcon, UnlockIcon } from "lucide-react"
import type { EndpointDoc } from "@/lib/api-docs-data"
import { CodeBlock } from "@/components/docs/code-block"
import { cn } from "@/lib/utils"

const METHOD_STYLES: Record<EndpointDoc["method"], string> = {
  GET: "bg-chart-2/15 text-foreground border-chart-2/30",
  POST: "bg-primary/15 text-foreground border-primary/30",
  PATCH: "bg-accent text-accent-foreground border-accent-foreground/20",
  DELETE: "bg-destructive/10 text-destructive border-destructive/30",
}

function AuthNote({ auth }: { auth: EndpointDoc["auth"] }) {
  if (auth === "none") return null
  const isRequired = auth === "required"
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {isRequired ? <LockIcon className="size-3" /> : <UnlockIcon className="size-3" />}
      {isRequired ? "Requires API key" : "Optional API key"}
    </span>
  )
}

/** One documented endpoint: method + path header, description, params, and copyable request/response examples. */
export function EndpointCard({ endpoint }: { endpoint: EndpointDoc }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold",
            METHOD_STYLES[endpoint.method],
          )}
        >
          {endpoint.method}
        </span>
        <code className="break-all font-mono text-sm text-foreground">{endpoint.path}</code>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{endpoint.description}</p>

      <div className="flex flex-wrap items-center gap-3">
        <AuthNote auth={endpoint.auth} />
        {endpoint.params ? (
          <span className="font-mono text-xs text-muted-foreground">{endpoint.params}</span>
        ) : null}
      </div>

      {endpoint.requestExample ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Request</p>
          <CodeBlock code={endpoint.requestExample} />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Response</p>
        <CodeBlock code={endpoint.responseExample} />
      </div>
    </div>
  )
}
