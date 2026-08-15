import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"

import { authClient } from "@/lib/auth-client"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

type Workspace = {
  id: string
  name: string
  slug: string
}

export function App() {
  const {
    data: session,
    isPending,
    error: sessionError,
  } = authClient.useSession()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [name, setName] = useState("")
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadWorkspaces() {
      try {
        const response = await fetch(`${API_URL}/workspaces`, {
          credentials: "include",
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Could not load workspaces")

        const data = (await response.json()) as Workspace[]
        setWorkspaces(data)
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return
        setActionError(
          error instanceof Error ? error.message : "Could not load workspaces"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoadingWorkspaces(false)
      }
    }

    void loadWorkspaces()
    return () => controller.abort()
  }, [session])

  async function signIn() {
    setActionError(null)
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.origin,
    })
    if (result.error) setActionError(result.error.message ?? "Sign-in failed")
  }

  async function signOut() {
    setActionError(null)
    const result = await authClient.signOut()
    if (result.error) {
      setActionError(result.error.message ?? "Sign-out failed")
      return
    }
    setWorkspaces([])
  }

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const workspaceName = name.trim()
    if (!workspaceName) return

    setActionError(null)
    setIsCreating(true)
    try {
      const response = await fetch(`${API_URL}/workspaces`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      })
      if (!response.ok) throw new Error("Could not create workspace")

      const workspace = (await response.json()) as Workspace
      setWorkspaces((current) => [...current, workspace])
      setName("")
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not create workspace"
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
          {(sessionError || actionError) && (
            <p className="text-sm text-destructive" role="alert">
              {sessionError?.message ?? actionError}
            </p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-2xl space-y-8 p-6 sm:p-10">
      <header className="flex items-start justify-between gap-4 border-b pb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Workspaces</h1>
          <p className="truncate text-sm text-muted-foreground">
            {session.user.name || session.user.email}
          </p>
        </div>
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </header>

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

      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      <section aria-label="Workspace list">
        {isLoadingWorkspaces ? (
          <p className="text-sm text-muted-foreground">Loading workspaces…</p>
        ) : workspaces.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No workspaces yet. Create one above.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {workspaces.map((workspace) => (
              <li className="px-4 py-3" key={workspace.id}>
                <p className="font-medium">{workspace.name}</p>
                <p className="text-xs text-muted-foreground">
                  {workspace.slug}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
