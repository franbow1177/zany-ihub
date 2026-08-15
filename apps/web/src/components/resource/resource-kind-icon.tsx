import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"

import type { ResourceKind } from "@/lib/api"
import { RESOURCE_KIND_CONFIG } from "@/lib/resource-kind"
import { getResourceIconOption } from "@/lib/resource-icons"

export function ResourceKindIcon({
  kind,
  icon,
  className,
}: {
  kind: ResourceKind
  icon?: string | null
  className?: string
}) {
  const selectedIcon = getResourceIconOption(icon)

  if (selectedIcon) {
    return (
      <HugeiconsIcon
        icon={selectedIcon.icon}
        className={className}
        strokeWidth={2}
      />
    )
  }

  if (icon) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center leading-none",
          className
        )}
      >
        {icon}
      </span>
    )
  }

  return (
    <HugeiconsIcon
      icon={RESOURCE_KIND_CONFIG[kind].icon}
      className={className}
      strokeWidth={2}
    />
  )
}
