import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { AppShell } from "@/components/app-shell"
import { apiFetch, type InvitationPreview, type Workspace } from "@/lib/api"
import { authClient } from "@/lib/auth-client"
import { WORKSPACE_NAV_CONFIG } from "@/lib/resource-kind"

export function InvitePage() {
  const { token = "" } = useParams()
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<InvitationPreview>(`/invitations/${token}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setPreview(result)
        setError(null)
      })
      .catch((previewError) => {
        if (
          previewError instanceof Error &&
          previewError.name === "AbortError"
        ) {
          return
        }
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Could not open invitation"
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [token])

  async function signIn() {
    setError(null)
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: window.location.href,
    })
    if (result.error) setError(result.error.message ?? "Sign-in failed")
  }

  async function switchAccount() {
    await authClient.signOut()
    await signIn()
  }

  async function accept() {
    setIsAccepting(true)
    setError(null)
    try {
      const workspace = await apiFetch<Workspace>(
        `/invitations/${token}/accept`,
        { method: "POST" }
      )
      navigate(`/workspace/${workspace.id}`, { replace: true })
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not join workspace"
      )
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <AppShell
      title="Workspace invitation"
      icon={<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />}
      backTo="/"
      backLabel="Workspaces"
    >
      {isLoading || isPending ? (
        <p className="text-sm text-muted-foreground">Opening invitation…</p>
      ) : error && !preview ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-medium">This invitation is unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : preview ? (
        <section className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
              <HugeiconsIcon
                icon={WORKSPACE_NAV_CONFIG.members.icon}
                strokeWidth={2}
              />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {preview.workspaceName}
                </h2>
                <Badge variant="secondary" className="capitalize">
                  {preview.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {preview.inviterName} invited {preview.invitedEmail} to join as
                a member.
              </p>
            </div>
          </div>

          {preview.status === "pending" ? (
            <div className="space-y-3 border-t pt-5">
              {session ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Signed in as {session.user.email}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="sm:flex-1"
                      disabled={isAccepting}
                      onClick={() => void accept()}
                    >
                      {isAccepting ? "Joining…" : "Join workspace"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void switchAccount()}
                    >
                      Use another Google account
                    </Button>
                  </div>
                </>
              ) : (
                <Button className="w-full" onClick={() => void signIn()}>
                  Sign in with Google to join
                </Button>
              )}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="border-t pt-5">
              <p className="text-sm text-muted-foreground">
                {preview.status === "accepted"
                  ? "This invitation has already been accepted."
                  : preview.status === "expired"
                    ? "This invitation has expired. Ask the workspace owner for a new link."
                    : "This invitation was revoked by the workspace owner."}
              </p>
            </div>
          )}
        </section>
      ) : null}
    </AppShell>
  )
}
