import { auth } from "../auth"

export type SessionUser = {
  id: string
  email: string
  name: string
}

export async function getSessionUser(
  request: Request
): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return null

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }
}
