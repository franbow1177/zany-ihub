import type { ReactNode } from "react"

import { PageHeader } from "@/components/page-header"
import type { Resource } from "@/lib/api"
import { ResourceKindIcon } from "./resource-kind-icon"

export function ResourcePageHeader({
  resource,
  title = resource.name,
  actions,
  className,
}: {
  resource: Resource
  title?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <PageHeader
      icon={
        <ResourceKindIcon
          kind={resource.kind}
          icon={resource.icon}
          className="size-5"
        />
      }
      title={title}
      actions={actions}
      className={className}
    />
  )
}
