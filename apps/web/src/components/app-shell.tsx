import { Link } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"

export function AppShell({
  title,
  subtitle,
  children,
  backTo,
  backLabel,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  backTo?: string
  backLabel?: string
}) {
  const { data: session } = authClient.useSession()

  async function signOut() {
    await authClient.signOut()
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-2xl space-y-8 p-6 sm:p-10">
      <header className="flex items-start justify-between gap-4 border-b pb-6">
        <div className="min-w-0 space-y-1">
          {backTo && (
            <Link
              className="text-xs text-muted-foreground hover:text-foreground"
              to={backTo}
            >
              ← {backLabel ?? "Back"}
            </Link>
          )}
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {session && (
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        )}
      </header>
      {children}
    </main>
  )
}
