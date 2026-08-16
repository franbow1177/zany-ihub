import { Zero } from "@rocicorp/zero"
import { ZeroProvider } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { schema } from "@workspace/zero/schema"

import { authClient } from "@/lib/auth-client"

const cacheURL = import.meta.env.VITE_ZERO_CACHE_URL ?? "http://localhost:4848"

function createZero(userID: string | undefined) {
  return new Zero({
    cacheURL,
    context: userID ? { userID } : undefined,
    mutators,
    schema,
    storageKey: "zany-ihub",
    userID,
  })
}

let currentZero: ReturnType<typeof createZero> | undefined
let currentUserID: string | undefined

function getZero(userID: string | undefined) {
  if (currentZero && currentUserID === userID && !currentZero.closed) {
    return currentZero
  }

  currentZero?.close()
  currentUserID = userID
  currentZero = createZero(userID)
  return currentZero
}

export function AppZeroProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const userID = session?.user.id

  if (isPending) return null

  const zero = getZero(userID)

  return (
    <ZeroProvider key={userID ?? "anonymous"} zero={zero}>
      {children}
    </ZeroProvider>
  )
}
