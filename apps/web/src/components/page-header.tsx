import type { ReactNode } from "react"
import { cn } from "@workspace/ui/lib/utils"

export function PageHeader({
  icon,
  title,
  actions,
  className,
}: {
  icon: ReactNode
  title: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex min-w-0 items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&_svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
