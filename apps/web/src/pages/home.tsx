import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useZero } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { queries } from "@workspace/zero/queries"
import { Button } from "@workspace/ui/components/button"

import { AppShell } from "@/components/app-shell"
import { authClient } from "@/lib/auth-client"

export function HomePage() {
  const navigate = useNavigate()
  const {
    data: session,
    isPending,
    error: sessionError,
  } = authClient.useSession()
  const zero = useZero()
  const [workspaces = [], workspaceState] = useQuery(
    queries.workspaces.mine(),
    { enabled: Boolean(session) }
  )
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setError(null)
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    })
    if (result.error) setError(result.error.message ?? "Sign-in failed")
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const workspaceName = name.trim()
    if (!workspaceName) return

    setError(null)
    setIsCreating(true)
    try {
      const id = crypto.randomUUID()
      const result = zero.mutate(
        mutators.workspaces.create({
          id,
          membershipId: crypto.randomUUID(),
          name: workspaceName,
          now: Date.now(),
        })
      )
      const serverResult = await result.server
      if (serverResult.type === "error") {
        throw new Error(serverResult.error.message)
      }
      setName("")
      navigate(`/workspace/${id}`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create workspace"
      )
    } finally {
      setIsCreating(false)
    }
  }

  if (isPending) {
    return (
      <main className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">
        Loading session…
      </main>
    )
  }

  if (!session) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <section className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Zany iHub</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to open your workspaces.
            </p>
          </div>
          <Button className="w-full" onClick={() => void signIn()}>
            Sign in with Google
          </Button>
          {(sessionError || error) && (
            <p className="text-sm text-destructive" role="alert">
              {sessionError?.message ?? error}
            </p>
          )}
        </section>
      </main>
    )
  }

  return (
    <AppShell
      title="Workspaces"
      subtitle={session.user.name || session.user.email}
    >
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={createWorkspace}
      >
        <label className="sr-only" htmlFor="workspace-name">
          Workspace name
        </label>
        <input
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          id="workspace-name"
          name="name"
          placeholder="New workspace name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button disabled={isCreating || !name.trim()} type="submit">
          {isCreating ? "Creating…" : "Create workspace"}
        </Button>
      </form>

      {(error || workspaceState.type === "error") && (
        <p className="text-sm text-destructive" role="alert">
          {error ||
            (workspaceState.type === "error"
              ? workspaceState.error.message
              : null)}
        </p>
      )}

      <section aria-label="Workspace list">
        {workspaceState.type === "unknown" ? (
          <p className="text-sm text-muted-foreground">Loading workspaces…</p>
        ) : workspaces.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No workspaces yet. Create one above.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  className="block px-4 py-3 transition-colors hover:bg-muted/50"
                  to={`/workspace/${workspace.id}`}
                >
                  <p className="font-medium">{workspace.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {workspace.slug}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  )
}
