import { ZeroProvider } from "@rocicorp/zero/react"
import { mutators } from "@workspace/zero/mutators"
import { schema } from "@workspace/zero/schema"

import { authClient } from "@/lib/auth-client"

const cacheURL =
  import.meta.env.VITE_ZERO_CACHE_URL ?? "http://localhost:4848"

export function AppZeroProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession()
  const userID = session?.user.id

  return (
    <ZeroProvider
      cacheURL={cacheURL}
      context={userID ? { userID } : undefined}
      mutators={mutators}
      schema={schema}
      storageKey="zany-ihub"
      userID={userID}
    >
      {children}
    </ZeroProvider>
  )
}
