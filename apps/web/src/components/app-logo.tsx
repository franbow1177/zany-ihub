import { cn } from "@workspace/ui/lib/utils"

export function AppLogo({
  className,
  title = "Zany iHub",
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      role="img"
      aria-label={title}
      className={cn("size-8 shrink-0 text-foreground", className)}
    >
      <title>{title}</title>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        <polygon points="45,10 190,10 190,155 155,190 10,190 10,45" />
        <line x1="190" y1="10" x2="10" y2="190" />
      </g>
    </svg>
  )
}
