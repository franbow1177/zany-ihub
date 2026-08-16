import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button, buttonVariants } from "@workspace/ui/components/button"

import { PageHeader } from "@/components/page-header"
import { authClient } from "@/lib/auth-client"

export function AppShell({
  title,
  icon,
  children,
  backTo,
  backLabel,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  backTo?: string
  backLabel?: string
}) {
  const { data: session } = authClient.useSession()

  async function signOut() {
    await authClient.signOut()
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-2xl space-y-8 p-6 sm:p-10">
      <PageHeader
        icon={icon}
        title={title}
        className="border-b pb-6"
        actions={
          (backTo || session) && (
            <>
              {backTo && (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  to={backTo}
                >
                  ← {backLabel ?? "Back"}
                </Link>
              )}
              {session && (
                <Button variant="outline" onClick={() => void signOut()}>
                  Sign out
                </Button>
              )}
            </>
          )
        }
      />
      {children}
    </main>
  )
}
